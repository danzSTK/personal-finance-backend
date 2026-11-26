import {
  IFiscalNoteProvider,
  ParsedFiscalNoteData,
} from '@/modules/fiscal-notes/application/ports/fiscal-note-provider.port';
import { FiscalNoteSupportedUfs } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNoteInput } from '@/modules/fiscal-notes/domain/value-objects/fiscal-note-input.vo';
import { SefazCeHtmlParser } from '@/modules/fiscal-notes/infrastructure/providers/sefaz-ce/sefaz-ce-html.parser';
import { SefazCeHttpClient } from '@/modules/fiscal-notes/infrastructure/providers/sefaz-ce/sefaz-ce.http-client';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SefazCeProvider extends IFiscalNoteProvider {
  readonly uf = FiscalNoteSupportedUfs.CE;

  constructor(
    private readonly httpClient: SefazCeHttpClient,
    private readonly htmlParser: SefazCeHtmlParser,
  ) {
    super();
  }

  async fetchAndParse(input: FiscalNoteInput): Promise<ParsedFiscalNoteData> {
    const response = await this.httpClient.queryFiscalNote(input);

    if (response.erro) {
      this.htmlParser.parseBusinessError(response.erro);
    }

    return this.htmlParser.parseHtml(response.xml ?? '', input.accessKey);
  }
}
