export const USER_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;
export const USER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const USER_NAME_MIN_LENGTH = 3;
export const USER_NAME_MAX_LENGTH = 50;

export const USER_EMAIL_MAX_LENGTH = 255;

export const USER_FIRST_NAME_MIN_LENGTH = 2;
export const USER_FIRST_NAME_MAX_LENGTH = 255;

export const USER_LAST_NAME_MIN_LENGTH = 2;
export const USER_LAST_NAME_MAX_LENGTH = 255;

export const USER_PASSWORD_MIN_LENGTH = 6;
export const USER_PASSWORD_MAX_LENGTH = 50;

export const CHANGER_USERNAME_THROTTLE_TIME_MS = 60_000; // 1 minute
export const CHANGER_USERNAME_THROTTLE_LIMIT = 3; // 3 attempts
export const CHANGER_USERNAME_THROTTLE_BLOCK_TIME_MS = 60_000 * 10; // 10 minute

export const USER_CHANGER_AVATAR_THROTTLE_TIME_MS = 60_000; // 1 minute
export const USER_CHANGER_AVATAR_THROTTLE_LIMIT = 3; // 3 attempts
export const USER_CHANGER_AVATAR_THROTTLE_BLOCK_TIME_MS = 60_000 * 60; // 1 hour block time
