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
  },
};
