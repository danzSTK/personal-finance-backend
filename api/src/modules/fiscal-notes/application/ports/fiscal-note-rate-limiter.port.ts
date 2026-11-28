export interface ConsumeSefazQuotaInput {
  userId: string;
  uf: string;
}

export abstract class IFiscalNoteRateLimiter {
  abstract consumeSefazQuota(input: ConsumeSefazQuotaInput): Promise<void>;
}
