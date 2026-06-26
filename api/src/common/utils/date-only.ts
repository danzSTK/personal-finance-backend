export type DateOnlyString = string & { readonly __dateOnlyBrand: unique symbol };

export const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateOnly(value: unknown): value is DateOnlyString {
  if (typeof value !== 'string' || !DATE_ONLY_REGEX.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function toDateOnly(value: string): DateOnlyString {
  if (!isValidDateOnly(value)) {
    throw new Error(`Invalid DateOnly value: ${value}`);
  }

  return value;
}

export function todayDateOnly(now = new Date()): DateOnlyString {
  return now.toISOString().slice(0, 10) as DateOnlyString;
}

export function dateOnlyFromDatabase(value: Date | string): DateOnlyString {
  if (typeof value === 'string') {
    return toDateOnly(value);
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return toDateOnly(`${year}-${month}-${day}`);
}
