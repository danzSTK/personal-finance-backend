export const CacheKeys = {
  users: {
    byId: (userId: string) => `users:id:${userId}`,
    byEmailIndex: (email: string) => `users:email-index:${email}`,
    byUserNameIndex: (userName: string) => `users:username-index:${userName}`,
  },

  auth: {
    blackList: (jti: string) => `auth:blacklist:${jti}`,

    refreshToken: (userId: string, jti: string) => `auth:rt:${userId}:${jti}`,

    userSessions: (userId: string) => `auth:sessions:${userId}`,
    googleLinkState: (state: string) => `auth:google-link:${state}`,
  },

  accounts: {
    byId: (accountId: string) => `accounts:id:${accountId}`,
    listByUserId: (userId: string, includeArchived: boolean = false) =>
      `accounts:list:user:${userId}:archived:${includeArchived ? '1' : '0'}`,
  },
};
