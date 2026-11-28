import {
  FiscalNoteHomologationNotAllowedError,
  FiscalNoteInvalidInputError,
  FiscalNoteUnsupportedUfError,
} from '@/modules/fiscal-notes/domain/errors';
import {
  FISCAL_NOTE_INPUT_MAX_LENGTH,
  FiscalNoteEnvironments,
  FiscalNoteQrVersions,
  FiscalNoteQueryChannels,
  FiscalNoteSupportedUfs,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNoteInput } from '@/modules/fiscal-notes/domain/value-objects/fiscal-note-input.vo';

const VALID_CE_ACCESS_KEY = '23261003539462000250651030000760541443208780';

function computeMod11AccessKey(base43: string): string {
  let sum = 0;
  let weight = 2;

  for (let i = base43.length - 1; i >= 0; i -= 1) {
    sum += Number(base43[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }

  const remainder = sum % 11;
  const dv = remainder === 0 || remainder === 1 ? 0 : 11 - remainder;

  return `${base43}${dv}`;
}

describe('FiscalNoteInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parse', () => {
    it('should parse a valid 44-digit CE NFC-e access key as QRCODE_V3', () => {
      const parsed = FiscalNoteInput.parse(VALID_CE_ACCESS_KEY);

      expect(parsed.accessKey).toBe(VALID_CE_ACCESS_KEY);
      expect(parsed.value).toBe(VALID_CE_ACCESS_KEY);
      expect(parsed.uf).toBe(FiscalNoteSupportedUfs.CE);
      expect(parsed.channel).toBe(FiscalNoteQueryChannels.QRCODE_V3);
      expect(parsed.qrVersion).toBe(FiscalNoteQrVersions.V3);
      expect(parsed.environment).toBe(FiscalNoteEnvironments.PRODUCTION);
      expect(parsed.cscId).toBeNull();
      expect(parsed.qrHash).toBeNull();
      expect(parsed.isContingency).toBe(false);
      expect(parsed.sourceHost).toBeNull();
      expect(parsed.unknownQrHost).toBeNull();
      expect(parsed.maskedAccessKey).toBe('23***8780');
    });

    it('should normalize spaces, dots, and hyphens in a 44-digit key', () => {
      const formatted = '2326 1003-5394.6200 0250-6510 3000.0760 5414-4320 8780';
      const parsed = FiscalNoteInput.create(formatted);

      expect(parsed.accessKey).toBe(VALID_CE_ACCESS_KEY);
      expect(parsed.channel).toBe(FiscalNoteQueryChannels.QRCODE_V3);
    });

    it('should parse a valid QR Code v2 URL from SEFAZ-CE allowlisted host', () => {
      const url = `http://nfce.sefaz.ce.gov.br/nfce/pagina?p=${VALID_CE_ACCESS_KEY}|2|1|1|ABCDEF123456`;
      const parsed = FiscalNoteInput.parse(url);

      expect(parsed.accessKey).toBe(VALID_CE_ACCESS_KEY);
      expect(parsed.channel).toBe(FiscalNoteQueryChannels.QRCODE_V2);
      expect(parsed.qrVersion).toBe(FiscalNoteQrVersions.V2);
      expect(parsed.cscId).toBe('1');
      expect(parsed.qrHash).toBe('ABCDEF123456');
      expect(parsed.isContingency).toBe(false);
      expect(parsed.sourceHost).toBe('nfce.sefaz.ce.gov.br');
      expect(parsed.unknownQrHost).toBeNull();
    });

    it('should parse a QR Code URL with uppercase parameter name P and direct payload', () => {
      const url = `HTTPS://NFCE.SEFAZ.CE.GOV.BR/nfce/pagina?P=${VALID_CE_ACCESS_KEY}|2|1|2|HASH99`;
      const fromUrl = FiscalNoteInput.parse(url);
      const fromDirect = FiscalNoteInput.parse(`${VALID_CE_ACCESS_KEY}|2|1|2|HASH99`);

      expect(fromUrl.sourceHost).toBe('nfce.sefaz.ce.gov.br');
      expect(fromUrl.unknownQrHost).toBeNull();
      expect(fromUrl.equals(fromDirect)).toBe(true);
    });

    it('should parse a valid QR Code v2 contingency (tpEmis=9, 8 fields) payload', () => {
      const contingencyPayload = `${VALID_CE_ACCESS_KEY}|2|1|15|4590|dGVzdGVkaWd2YWw=|1|HASHCONTINGENCY`;
      const parsed = FiscalNoteInput.parse(contingencyPayload);

      expect(parsed.channel).toBe(FiscalNoteQueryChannels.QRCODE_V2);
      expect(parsed.isContingency).toBe(true);
      expect(parsed.contingencyIssueDay).toBe('15');
      expect(parsed.contingencyTotalAmount).toBe('4590');
      expect(parsed.contingencyDigestValue).toBe('dGVzdGVkaWd2YWw=');
      expect(parsed.cscId).toBe('1');
      expect(parsed.qrHash).toBe('HASHCONTINGENCY');
    });

    it('should parse a real POS QR Code v2 contingency URL with empty digVal (||) while preserving QRCODE_V2 metadata', () => {
      const realContingencyUrl =
        'http://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html?p=23261103539462000250651030000832639499160820|2|1|25|15.63||1|D1042A26152D9548BC455EF1DCD7C3C538B5E2D9';
      const parsed = FiscalNoteInput.parse(realContingencyUrl);

      expect(parsed.accessKey).toBe('23261103539462000250651030000832639499160820');
      expect(parsed.uf).toBe(FiscalNoteSupportedUfs.CE);
      expect(parsed.channel).toBe(FiscalNoteQueryChannels.QRCODE_V2);
      expect(parsed.qrVersion).toBe(FiscalNoteQrVersions.V2);
      expect(parsed.isContingency).toBe(true);
      expect(parsed.contingencyIssueDay).toBe('25');
      expect(parsed.contingencyTotalAmount).toBe('15.63');
      expect(parsed.contingencyDigestValue).toBeNull();
      expect(parsed.cscId).toBe('1');
      expect(parsed.qrHash).toBe('D1042A26152D9548BC455EF1DCD7C3C538B5E2D9');
      expect(parsed.sourceHost).toBe('nfce.sefaz.ce.gov.br');
      expect(parsed.unknownQrHost).toBeNull();
    });

    it('should still record unknownQrHost on a QR Code v2 contingency URL with empty digVal', () => {
      const unknownHostContingencyUrl =
        'https://unknown.pos.example/pages/ShowNFCe.html?p=23261103539462000250651030000832639499160820|2|1|25|15.63||1|D1042A26152D9548BC455EF1DCD7C3C538B5E2D9';
      const parsed = FiscalNoteInput.parse(unknownHostContingencyUrl);

      expect(parsed.channel).toBe(FiscalNoteQueryChannels.QRCODE_V2);
      expect(parsed.contingencyDigestValue).toBeNull();
      expect(parsed.sourceHost).toBe('unknown.pos.example');
      expect(parsed.unknownQrHost).toBe('unknown.pos.example');
    });

    it('should parse a valid QR Code v3 payload', () => {
      const v3Url = `http://nfce.sefaz.ce.gov.br/nfce/pagina?p=${VALID_CE_ACCESS_KEY}|3|1`;
      const parsed = FiscalNoteInput.parse(v3Url);

      expect(parsed.channel).toBe(FiscalNoteQueryChannels.QRCODE_V3);
      expect(parsed.qrVersion).toBe(FiscalNoteQrVersions.V3);
      expect(parsed.cscId).toBeNull();
      expect(parsed.qrHash).toBeNull();
    });

    it('should record unknownQrHost when URL points to a non-allowlisted host', () => {
      const evilUrl = `https://evil.attacker.example/nfce?p=${VALID_CE_ACCESS_KEY}|2|1|1|HASH`;
      const parsed = FiscalNoteInput.parse(evilUrl);

      expect(parsed.accessKey).toBe(VALID_CE_ACCESS_KEY);
      expect(parsed.sourceHost).toBe('evil.attacker.example');
      expect(parsed.unknownQrHost).toBe('evil.attacker.example');
    });

    it('should reject empty or overly long input', () => {
      expect(() => FiscalNoteInput.parse('')).toThrow(FiscalNoteInvalidInputError);
      expect(() => FiscalNoteInput.parse('   ')).toThrow(FiscalNoteInvalidInputError);
      expect(() => FiscalNoteInput.parse('a'.repeat(FISCAL_NOTE_INPUT_MAX_LENGTH + 1))).toThrow(
        FiscalNoteInvalidInputError,
      );
    });

    it('should reject URL without p parameter or unsupported URL scheme', () => {
      expect(() => FiscalNoteInput.parse('http://nfce.sefaz.ce.gov.br/nfce/pagina?foo=bar')).toThrow(
        FiscalNoteInvalidInputError,
      );
      expect(() => FiscalNoteInput.parse('ftp://nfce.sefaz.ce.gov.br/nfce?p=123|2|1|1|A')).toThrow(
        FiscalNoteInvalidInputError,
      );
    });

    it('should reject invalid mod-11 check digit', () => {
      const badDvKey = `${VALID_CE_ACCESS_KEY.slice(0, 43)}9`;
      expect(() => FiscalNoteInput.parse(badDvKey)).toThrow(FiscalNoteInvalidInputError);
    });

    it('should reject non-NFC-e fiscal model (e.g. model 55 NF-e)', () => {
      const model55Base43 = `${VALID_CE_ACCESS_KEY.slice(0, 20)}55${VALID_CE_ACCESS_KEY.slice(22, 43)}`;
      const model55Key = computeMod11AccessKey(model55Base43);

      expect(() => FiscalNoteInput.parse(model55Key)).toThrow(FiscalNoteInvalidInputError);
    });

    it('should reject homologation environment (2) with FiscalNoteHomologationNotAllowedError', () => {
      const homologPayload = `${VALID_CE_ACCESS_KEY}|2|2|1|HASH`;

      expect(() => FiscalNoteInput.parse(homologPayload)).toThrow(FiscalNoteHomologationNotAllowedError);
    });

    it('should reject unknown environment other than 1 or 2', () => {
      const unknownEnvPayload = `${VALID_CE_ACCESS_KEY}|2|9|1|HASH`;

      expect(() => FiscalNoteInput.parse(unknownEnvPayload)).toThrow(FiscalNoteInvalidInputError);
    });

    it('should reject unsupported UF (e.g. SP 35) with FiscalNoteUnsupportedUfError', () => {
      const spBase43 = `35${VALID_CE_ACCESS_KEY.slice(2, 43)}`;
      const spKey = computeMod11AccessKey(spBase43);

      expect(() => FiscalNoteInput.parse(spKey)).toThrow(FiscalNoteUnsupportedUfError);
    });

    it('should reject malformed QR v2 payloads with wrong field count or empty fields', () => {
      expect(() => FiscalNoteInput.parse(`${VALID_CE_ACCESS_KEY}|2|1|1`)).toThrow(FiscalNoteInvalidInputError);
      expect(() => FiscalNoteInput.parse(`${VALID_CE_ACCESS_KEY}|2|1||HASH`)).toThrow(FiscalNoteInvalidInputError);
      expect(() => FiscalNoteInput.parse(`${VALID_CE_ACCESS_KEY}|4|1`)).toThrow(FiscalNoteInvalidInputError);
      expect(() => FiscalNoteInput.parse(`${VALID_CE_ACCESS_KEY}|2|1||15.63||1|HASH`)).toThrow(
        FiscalNoteInvalidInputError,
      );
      expect(() => FiscalNoteInput.parse(`${VALID_CE_ACCESS_KEY}|2|1|25|||1|HASH`)).toThrow(
        FiscalNoteInvalidInputError,
      );
      expect(() => FiscalNoteInput.parse(`${VALID_CE_ACCESS_KEY}|2|1|25|15.63|||HASH`)).toThrow(
        FiscalNoteInvalidInputError,
      );
      expect(() => FiscalNoteInput.parse(`${VALID_CE_ACCESS_KEY}|2|1|25|15.63||1|`)).toThrow(
        FiscalNoteInvalidInputError,
      );
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute props without re-validating', () => {
      const input = FiscalNoteInput.parse(VALID_CE_ACCESS_KEY);
      const reconstituted = FiscalNoteInput.reconstitute({
        accessKey: input.accessKey,
        uf: input.uf,
        channel: input.channel,
        qrVersion: input.qrVersion,
        environment: input.environment,
        cscId: input.cscId,
        qrHash: input.qrHash,
        contingencyIssueDay: input.contingencyIssueDay,
        contingencyTotalAmount: input.contingencyTotalAmount,
        contingencyDigestValue: input.contingencyDigestValue,
        sourceHost: input.sourceHost,
        unknownQrHost: input.unknownQrHost,
      });

      expect(reconstituted.equals(input)).toBe(true);
    });
  });
});
