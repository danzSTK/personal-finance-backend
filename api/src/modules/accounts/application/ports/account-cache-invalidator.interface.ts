export abstract class IAccountCacheInvalidator {
  abstract invalidateUserAccounts(userId: string): Promise<void>;
}
