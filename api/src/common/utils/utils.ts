export function applyIfDefined<T>(value: T | undefined, fn: (v: T) => void) {
  if (value !== undefined) {
    fn(value);
  }
}
