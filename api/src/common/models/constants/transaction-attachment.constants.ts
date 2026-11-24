export const TRANSACTION_ATTACHMENT_MAX_COUNT = 3;
export const TRANSACTION_ATTACHMENT_MIN_POSITION = 0;
export const TRANSACTION_ATTACHMENT_MAX_POSITION = TRANSACTION_ATTACHMENT_MAX_COUNT - 1;
export const TRANSACTION_ATTACHMENT_MAX_INPUT_BYTES = 5 * 1024 * 1024; // 5 MB
export const TRANSACTION_ATTACHMENT_MAX_INPUT_PIXELS = 60_000_000; // 60 MP

export const TRANSACTION_ATTACHMENT_OPTIMIZED_MEDIA_TYPE = 'image/webp';
export const TRANSACTION_ATTACHMENT_OPTIMIZED_FORMAT = 'webp';
export const TRANSACTION_ATTACHMENT_OPTIMIZED_MAX_DIMENSION = 2560;
export const TRANSACTION_ATTACHMENT_OPTIMIZED_WEBP_QUALITY = 80;

export const TRANSACTION_ATTACHMENT_ALLOWED_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type TransactionAttachmentAllowedMediaType = (typeof TRANSACTION_ATTACHMENT_ALLOWED_MEDIA_TYPES)[number];

export const TRANSACTION_ATTACHMENT_MEDIA_TYPE_LABELS: Record<TransactionAttachmentAllowedMediaType, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/webp': 'WebP',
};

export function formatAllowedTransactionAttachmentTypes(): string {
  const labels = TRANSACTION_ATTACHMENT_ALLOWED_MEDIA_TYPES.map(
    mediaType => TRANSACTION_ATTACHMENT_MEDIA_TYPE_LABELS[mediaType],
  );

  if (labels.length <= 1) {
    return labels[0] ?? '';
  }

  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}
