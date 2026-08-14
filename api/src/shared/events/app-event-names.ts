export const AppEventNames = {
  UserCreated: 'user.created',
  UserEmailVerified: 'user.email.verified',
  UserAvatarUpdated: 'user.avatar.updated',
  UserAvatarRemoved: 'user.avatar.removed',
  PasswordChangeStateRefreshRequested: 'auth.password-change.state-refresh-requested',
  PasswordChanged: 'auth.password-change.changed',
  PasswordChangeBlockStarted: 'auth.password-change.block-started',
  UserSessionsRevokeAllRequested: 'auth.sessions.revoke-all-requested',
} as const;
