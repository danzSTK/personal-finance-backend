export const CacheKeys = {
  users: {
    byId: (userId: string) => `users:id:${userId}`,
    byEmail: (email: string) => `users:email:${email}`,
  },

  auth: {
    blackList: (jti: string) => `auth:blacklist:${jti}`,

    refreshToken: (userId: string, jti: string) => `auth:rt:${userId}:${jti}`,

    userSessions: (userId: string) => `auth:sessions:${userId}`,
  },
};
