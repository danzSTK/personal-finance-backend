export const USER_AVATAR_MAX_INPUT_BYTES = 5 * 1024 * 1024; // 5MB
export const USER_AVATAR_MAX_INPUT_PIXELS = 5000 * 5000; // 25,000,000 pixels
export const USER_AVATAR_WIDTH = 512;
export const USER_AVATAR_HEIGHT = 512;
export const USER_AVATAR_WEBP_QUALITY = 82;

export const USER_AVATAR_ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type UserAvatarAllowedMediaType = (typeof USER_AVATAR_ALLOWED_MEDIA_TYPES)[number];
