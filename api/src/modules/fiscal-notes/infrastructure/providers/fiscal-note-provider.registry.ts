import { IFiscalNoteProvider } from '@/modules/fiscal-notes/application/ports/fiscal-note-provider.port';
import { IFiscalNoteProviderRegistry } from '@/modules/fiscal-notes/application/ports/fiscal-note-provider-registry.port';
import { FISCAL_NOTE_PROVIDERS_TOKEN } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class FiscalNoteProviderRegistry extends IFiscalNoteProviderRegistry {
  private readonly providersByUf = new Map<string, IFiscalNoteProvider>();

  constructor(
    @Inject(FISCAL_NOTE_PROVIDERS_TOKEN)
    providers: IFiscalNoteProvider[],
  ) {
    super();
    for (const provider of providers) {
      this.providersByUf.set(provider.uf, provider);
    }
  }

  getProvider(uf: string): IFiscalNoteProvider | null {
    return this.providersByUf.get(uf) ?? null;
  }

  isSupported(uf: string): boolean {
    return this.providersByUf.has(uf);
  }
}
