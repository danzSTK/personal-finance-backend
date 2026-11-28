/* eslint-disable @typescript-eslint/unbound-method */
import { FiscalNoteSefazNotFoundError } from '@/modules/fiscal-notes/application/errors';
import { ParsedFiscalNoteData } from '@/modules/fiscal-notes/application/ports';
import { FiscalNoteSupportedUfs } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNoteInput } from '@/modules/fiscal-notes/domain/value-objects/fiscal-note-input.vo';
import { SefazCeHtmlParser } from '@/modules/fiscal-notes/infrastructure/providers/sefaz-ce/sefaz-ce-html.parser';
import { SefazCeHttpClient } from '@/modules/fiscal-notes/infrastructure/providers/sefaz-ce/sefaz-ce.http-client';
import { SefazCeProvider } from '@/modules/fiscal-notes/infrastructure/providers/sefaz-ce/sefaz-ce.provider';

const VALID_CE_KEY = '23261003539462000250651030000760541443208780';

describe('SefazCeProvider', () => {
  let httpClient: jest.Mocked<SefazCeHttpClient>;
  let htmlParser: jest.Mocked<SefazCeHtmlParser>;
  let provider: SefazCeProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    httpClient = {
      queryFiscalNote: jest.fn(),
    } as unknown as jest.Mocked<SefazCeHttpClient>;
    htmlParser = {
      parseBusinessError: jest.fn(),
      parseHtml: jest.fn(),
    } as unknown as jest.Mocked<SefazCeHtmlParser>;
    provider = new SefazCeProvider(httpClient, htmlParser);
  });

  describe('fetchAndParse', () => {
    it('exposes CE UF code', () => {
      expect(provider.uf).toBe(FiscalNoteSupportedUfs.CE);
    });

    it('delegates xml response to htmlParser.parseHtml', async () => {
      const input = FiscalNoteInput.parse(VALID_CE_KEY);
      const parsed = { accessKey: VALID_CE_KEY } as ParsedFiscalNoteData;
      httpClient.queryFiscalNote.mockResolvedValue({ xml: '<html>note</html>' });
      htmlParser.parseHtml.mockReturnValue(parsed);

      const result = await provider.fetchAndParse(input);

      expect(result).toBe(parsed);
      expect(htmlParser.parseHtml).toHaveBeenCalledWith('<html>note</html>', VALID_CE_KEY);
    });

    it('delegates erro response to htmlParser.parseBusinessError', async () => {
      const input = FiscalNoteInput.parse(VALID_CE_KEY);
      httpClient.queryFiscalNote.mockResolvedValue({ erro: '100 - Nao encontrada' });
      htmlParser.parseBusinessError.mockImplementation(() => {
        throw new FiscalNoteSefazNotFoundError();
      });

      await expect(provider.fetchAndParse(input)).rejects.toThrow(FiscalNoteSefazNotFoundError);
      expect(htmlParser.parseBusinessError).toHaveBeenCalledWith('100 - Nao encontrada');
    });
  });
});
