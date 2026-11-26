import {
  FiscalNoteHomologationNotAllowedError,
  FiscalNoteInvalidInputError,
  FiscalNoteUnsupportedUfError,
} from '@/modules/fiscal-notes/application/errors';
import {
  FISCAL_NOTE_ACCESS_KEY_DATA_LENGTH,
  FISCAL_NOTE_ACCESS_KEY_LENGTH,
  FISCAL_NOTE_ACCESS_KEY_MODEL_END,
  FISCAL_NOTE_ACCESS_KEY_MODEL_START,
  FISCAL_NOTE_ACCESS_KEY_REGEX,
  FISCAL_NOTE_ACCESS_KEY_UF_END,
  FISCAL_NOTE_ACCESS_KEY_UF_START,
  FISCAL_NOTE_ALLOWED_HOSTS_BY_UF,
  FISCAL_NOTE_INPUT_MAX_LENGTH,
  FISCAL_NOTE_MODEL_NFCE,
  FISCAL_NOTE_QR_PARAM_NAME,
  FISCAL_NOTE_QR_V2_CONTINGENCY_PARTS,
  FISCAL_NOTE_QR_V2_NORMAL_PARTS,
  FISCAL_NOTE_QR_V3_MIN_PARTS,
  FISCAL_NOTE_SUPPORTED_UF_LIST,
  FiscalNoteEnvironment,
  FiscalNoteEnvironments,
  FiscalNoteQrVersion,
  FiscalNoteQrVersions,
  FiscalNoteQueryChannel,
  FiscalNoteQueryChannels,
  FiscalNoteSupportedUf,
  maskAccessKeyForLog,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';

const HTTP_URL_SCHEME_REGEX = /^https?:\/\//i;
const ANY_URL_SCHEME_REGEX = /^[a-z][a-z0-9+.-]*:\/\//i;
const NON_DIGIT_REGEX = /\D/g;

export interface FiscalNoteInputProps {
  accessKey: string;
  uf: string;
  channel: FiscalNoteQueryChannel;
  qrVersion: FiscalNoteQrVersion;
  environment: FiscalNoteEnvironment;
  cscId: string | null;
  qrHash: string | null;
  contingencyIssueDay: string | null;
  contingencyTotalAmount: string | null;
  contingencyDigestValue: string | null;
  sourceHost: string | null;
  unknownQrHost: string | null;
}

export class FiscalNoteInput {
  private constructor(private readonly props: FiscalNoteInputProps) {}

  get value(): string {
    return this.props.accessKey;
  }

  get accessKey(): string {
    return this.props.accessKey;
  }

  get uf(): string {
    return this.props.uf;
  }

  get channel(): FiscalNoteQueryChannel {
    return this.props.channel;
  }

  get qrVersion(): FiscalNoteQrVersion {
    return this.props.qrVersion;
  }

  get environment(): FiscalNoteEnvironment {
    return this.props.environment;
  }

  get cscId(): string | null {
    return this.props.cscId;
  }

  get qrHash(): string | null {
    return this.props.qrHash;
  }

  get contingencyIssueDay(): string | null {
    return this.props.contingencyIssueDay;
  }

  get contingencyTotalAmount(): string | null {
    return this.props.contingencyTotalAmount;
  }

  get contingencyDigestValue(): string | null {
    return this.props.contingencyDigestValue;
  }

  get isContingency(): boolean {
    return this.props.contingencyIssueDay !== null;
  }

  get sourceHost(): string | null {
    return this.props.sourceHost;
  }

  get unknownQrHost(): string | null {
    return this.props.unknownQrHost;
  }

  get maskedAccessKey(): string {
    return maskAccessKeyForLog(this.props.accessKey);
  }

  static create(rawInput: string): FiscalNoteInput {
    return FiscalNoteInput.parse(rawInput);
  }

  static parse(rawInput: string): FiscalNoteInput {
    if (typeof rawInput !== 'string') {
      throw new FiscalNoteInvalidInputError('Fiscal note input must be a string.');
    }

    const trimmed = rawInput.trim();
    if (!trimmed || trimmed.length > FISCAL_NOTE_INPUT_MAX_LENGTH) {
      throw new FiscalNoteInvalidInputError(
        `Fiscal note input must be non-empty and at most ${FISCAL_NOTE_INPUT_MAX_LENGTH} characters.`,
      );
    }

    const extracted = FiscalNoteInput.extractPayload(trimmed);

    return FiscalNoteInput.buildAndValidate(extracted);
  }

  static reconstitute(props: FiscalNoteInputProps): FiscalNoteInput {
    return new FiscalNoteInput({ ...props });
  }

  equals(other: FiscalNoteInput): boolean {
    return (
      this.props.accessKey === other.props.accessKey &&
      this.props.channel === other.props.channel &&
      this.props.qrVersion === other.props.qrVersion &&
      this.props.environment === other.props.environment &&
      this.props.cscId === other.props.cscId &&
      this.props.qrHash === other.props.qrHash &&
      this.props.contingencyIssueDay === other.props.contingencyIssueDay &&
      this.props.contingencyTotalAmount === other.props.contingencyTotalAmount &&
      this.props.contingencyDigestValue === other.props.contingencyDigestValue
    );
  }

  private static extractPayload(trimmed: string): Omit<FiscalNoteInputProps, 'uf' | 'unknownQrHost'> {
    if (HTTP_URL_SCHEME_REGEX.test(trimmed)) {
      const { sourceHost, qrPayload } = FiscalNoteInput.parseQrUrl(trimmed);
      if (!qrPayload.includes('|')) {
        throw new FiscalNoteInvalidInputError('QR Code parameter "p" is malformed.');
      }

      return {
        ...FiscalNoteInput.parsePipePayload(qrPayload),
        sourceHost,
      };
    }

    if (ANY_URL_SCHEME_REGEX.test(trimmed)) {
      throw new FiscalNoteInvalidInputError('Fiscal note URL scheme must be HTTP or HTTPS.');
    }

    if (trimmed.includes('|')) {
      return {
        ...FiscalNoteInput.parsePipePayload(trimmed),
        sourceHost: null,
      };
    }

    const digitsOnly = trimmed.replace(NON_DIGIT_REGEX, '');
    if (digitsOnly.length !== FISCAL_NOTE_ACCESS_KEY_LENGTH) {
      throw new FiscalNoteInvalidInputError('Fiscal note access key must contain exactly 44 numeric digits.');
    }

    return {
      accessKey: digitsOnly,
      channel: FiscalNoteQueryChannels.QRCODE_V3,
      qrVersion: FiscalNoteQrVersions.V3,
      environment: FiscalNoteEnvironments.PRODUCTION,
      cscId: null,
      qrHash: null,
      contingencyIssueDay: null,
      contingencyTotalAmount: null,
      contingencyDigestValue: null,
      sourceHost: null,
    };
  }

  private static parseQrUrl(rawUrl: string): { sourceHost: string; qrPayload: string } {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      throw new FiscalNoteInvalidInputError('Invalid fiscal note QR Code URL.');
    }

    const sourceHost = parsedUrl.hostname.toLowerCase();
    if (!sourceHost) {
      throw new FiscalNoteInvalidInputError('Fiscal note QR Code URL must contain a valid host.');
    }

    let qrPayload: string | null = null;
    for (const [key, value] of parsedUrl.searchParams.entries()) {
      if (key.toLowerCase() === FISCAL_NOTE_QR_PARAM_NAME) {
        qrPayload = value.trim();
        break;
      }
    }

    if (!qrPayload) {
      throw new FiscalNoteInvalidInputError('Fiscal note QR Code URL must include parameter "p".');
    }

    return { sourceHost, qrPayload };
  }

  private static parsePipePayload(payload: string): Omit<FiscalNoteInputProps, 'uf' | 'sourceHost' | 'unknownQrHost'> {
    const parts = payload.split('|').map(part => part.trim());
    if (parts.length < FISCAL_NOTE_QR_V3_MIN_PARTS) {
      throw new FiscalNoteInvalidInputError('Malformed QR Code payload.');
    }

    const accessKey = parts[0].replace(NON_DIGIT_REGEX, '');
    const version = parts[1];
    const environment = parts[2];

    if (environment === FiscalNoteEnvironments.HOMOLOGATION) {
      throw new FiscalNoteHomologationNotAllowedError();
    }

    if (environment !== FiscalNoteEnvironments.PRODUCTION) {
      throw new FiscalNoteInvalidInputError('Invalid fiscal note environment in QR Code payload.');
    }

    if (version === FiscalNoteQrVersions.V2) {
      if (parts.length === FISCAL_NOTE_QR_V2_NORMAL_PARTS) {
        const cscId = parts[3];
        const qrHash = parts[4];
        if (!cscId || !qrHash) {
          throw new FiscalNoteInvalidInputError('QR Code v2 payload must include CSC identifier and hash.');
        }

        return {
          accessKey,
          channel: FiscalNoteQueryChannels.QRCODE_V2,
          qrVersion: FiscalNoteQrVersions.V2,
          environment: FiscalNoteEnvironments.PRODUCTION,
          cscId,
          qrHash,
          contingencyIssueDay: null,
          contingencyTotalAmount: null,
          contingencyDigestValue: null,
        };
      }

      if (parts.length === FISCAL_NOTE_QR_V2_CONTINGENCY_PARTS) {
        const contingencyIssueDay = parts[3];
        const contingencyTotalAmount = parts[4];
        const contingencyDigestValue = parts[5];
        const cscId = parts[6];
        const qrHash = parts[7];

        if (!contingencyIssueDay || !contingencyTotalAmount || !contingencyDigestValue || !cscId || !qrHash) {
          throw new FiscalNoteInvalidInputError('Contingency QR Code v2 payload has missing required fields.');
        }

        return {
          accessKey,
          channel: FiscalNoteQueryChannels.QRCODE_V2,
          qrVersion: FiscalNoteQrVersions.V2,
          environment: FiscalNoteEnvironments.PRODUCTION,
          cscId,
          qrHash,
          contingencyIssueDay,
          contingencyTotalAmount,
          contingencyDigestValue,
        };
      }

      throw new FiscalNoteInvalidInputError('Invalid number of fields for QR Code v2 payload.');
    }

    if (version === FiscalNoteQrVersions.V3) {
      return {
        accessKey,
        channel: FiscalNoteQueryChannels.QRCODE_V3,
        qrVersion: FiscalNoteQrVersions.V3,
        environment: FiscalNoteEnvironments.PRODUCTION,
        cscId: null,
        qrHash: null,
        contingencyIssueDay: null,
        contingencyTotalAmount: null,
        contingencyDigestValue: null,
      };
    }

    throw new FiscalNoteInvalidInputError('Unsupported QR Code version in payload.');
  }

  private static buildAndValidate(extracted: Omit<FiscalNoteInputProps, 'uf' | 'unknownQrHost'>): FiscalNoteInput {
    const { accessKey, sourceHost } = extracted;

    if (!FISCAL_NOTE_ACCESS_KEY_REGEX.test(accessKey)) {
      throw new FiscalNoteInvalidInputError('Fiscal note access key must contain exactly 44 numeric digits.');
    }

    const model = accessKey.slice(FISCAL_NOTE_ACCESS_KEY_MODEL_START, FISCAL_NOTE_ACCESS_KEY_MODEL_END);
    if (model !== FISCAL_NOTE_MODEL_NFCE) {
      throw new FiscalNoteInvalidInputError(`Only NFC-e (model ${FISCAL_NOTE_MODEL_NFCE}) is supported.`);
    }

    if (!FiscalNoteInput.hasValidMod11CheckDigit(accessKey)) {
      throw new FiscalNoteInvalidInputError('Fiscal note access key check digit is invalid.');
    }

    const uf = accessKey.slice(FISCAL_NOTE_ACCESS_KEY_UF_START, FISCAL_NOTE_ACCESS_KEY_UF_END);
    if (!FISCAL_NOTE_SUPPORTED_UF_LIST.includes(uf as FiscalNoteSupportedUf)) {
      throw new FiscalNoteUnsupportedUfError(uf);
    }

    const allowedHosts = FISCAL_NOTE_ALLOWED_HOSTS_BY_UF[uf] ?? [];
    const unknownQrHost = sourceHost !== null && !allowedHosts.includes(sourceHost) ? sourceHost : null;

    return new FiscalNoteInput({
      ...extracted,
      uf,
      unknownQrHost,
    });
  }

  private static hasValidMod11CheckDigit(accessKey: string): boolean {
    let sum = 0;
    let weight = 2;

    for (let index = FISCAL_NOTE_ACCESS_KEY_DATA_LENGTH - 1; index >= 0; index -= 1) {
      const digit = Number(accessKey[index]);
      sum += digit * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }

    const remainder = sum % 11;
    const expectedDigit = remainder === 0 || remainder === 1 ? 0 : 11 - remainder;
    const actualDigit = Number(accessKey[FISCAL_NOTE_ACCESS_KEY_DATA_LENGTH]);

    return actualDigit === expectedDigit;
  }
}
