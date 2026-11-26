import { IFiscalNoteProvider } from '@/modules/fiscal-notes/application/ports/fiscal-note-provider.port';

export abstract class IFiscalNoteProviderRegistry {
  abstract getProvider(uf: string): IFiscalNoteProvider | null;

  abstract isSupported(uf: string): boolean;
}
