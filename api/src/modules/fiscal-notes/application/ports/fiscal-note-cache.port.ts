import { ParsedFiscalNoteData } from '@/modules/fiscal-notes/application/ports/fiscal-note-provider.port';

export abstract class IFiscalNoteCache {
  abstract get(accessKey: string): Promise<ParsedFiscalNoteData | null>;

  abstract set(accessKey: string, data: ParsedFiscalNoteData): Promise<void>;
}
