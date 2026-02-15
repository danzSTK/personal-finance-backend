import { Transform, TransformFnParams } from 'class-transformer';

export const TrimAndLowerCase = () => {
  return Transform(({ value }: TransformFnParams) => {
    if (typeof value !== 'string') {
      console.warn(`[TrimAndLowerCase] Expected a string, got ${typeof value}`);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value;
    }

    return value.trim().toLowerCase();
  });
};
