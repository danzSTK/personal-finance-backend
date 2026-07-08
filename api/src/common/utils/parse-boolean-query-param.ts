import { TransformFnParams } from 'class-transformer';

export const parseBooleanQueryParam = (value: unknown): unknown => {
  if (value === 'true' || value === true) {
    return true;
  }

  if (value === 'false' || value === false) {
    return false;
  }

  return value;
};

export const parseBooleanTransformValue = ({ obj, key, value }: TransformFnParams): unknown => {
  if (obj && typeof obj === 'object' && key in obj) {
    return parseBooleanQueryParam((obj as Record<string, unknown>)[key]);
  }

  return parseBooleanQueryParam(value);
};
