import { AccountType, CategoryType } from '@/common/models/enums';

const passwordChangeScope = (userId: string) => `auth:password-change:{${userId}}`;

export const CacheKeys = {
  users: {
    byId: (userId: string) => `users:id:${userId}`,
    byEmailIndex: (email: string) => `users:email-index:${email}`,
    byUserNameIndex: (userName: string) => `users:username-index:${userName}`,
    usernameAlreadyExists: (userName: string) => `users:username-exists:${userName}`,
  },

  auth: {
    blackList: (jti: string) => `auth:blacklist:${jti}`,

    refreshToken: (userId: string, jti: string) => `auth:rt:${userId}:${jti}`,

    userSessions: (userId: string) => `auth:sessions:${userId}`,
    googleLinkState: (state: string) => `auth:google-link:${state}`,
    passwordChange: {
      failures: (userId: string) => `${passwordChangeScope(userId)}:failures`,
      block: (userId: string) => `${passwordChangeScope(userId)}:block`,
      blockRecurrence: (userId: string) => `${passwordChangeScope(userId)}:block-recurrence`,
      changes: (userId: string) => `${passwordChangeScope(userId)}:changes`,
      initialized: (userId: string): string => `${passwordChangeScope(userId)}:initialized`,

      pending: (userId: string): string => `${passwordChangeScope(userId)}:pending`,

      costByIp: (ipFingerprint: string): string => `auth:password-change:cost:ip:${ipFingerprint}`,

      costBySession: (sessionFingerprint: string): string => `auth:password-change:cost:session:${sessionFingerprint}`,
    },
  },

  accounts: {
    byId: (accountId: string) => `accounts:id:${accountId}`,
    listByUserId: (userId: string, includeArchived: boolean = false) =>
      `accounts:list:user:${userId}:archived:${includeArchived ? '1' : '0'}`,
    byUserIdAndType: (userId: string, type: AccountType) => `accounts:user:${userId}:type:${type}`,
  },

  categories: {
    byId: (categoryId: string) => `categories:id:${categoryId}`,
    listByUserId: (userId: string, includeArchived: boolean = false) =>
      `categories:list:user:${userId}:archived:${includeArchived ? '1' : '0'}`,
    listByUserIdAndType: (userId: string, type: CategoryType, includeArchived: boolean = false) =>
      `categories:list:user:${userId}:type:${type}:archived:${includeArchived ? '1' : '0'}`,
  },
};
