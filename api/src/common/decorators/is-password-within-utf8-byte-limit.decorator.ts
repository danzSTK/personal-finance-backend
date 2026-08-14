import { USER_PASSWORD_MAX_UTF8_BYTES } from '@/common/models/constants';
import { isPasswordWithinUtf8ByteLimit } from '@/common/utils/password-byte-length.util';
import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

export function IsPasswordWithinUtf8ByteLimit(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target, propertyName) => {
    registerDecorator({
      name: 'isPasswordWithinUtf8ByteLimit',
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && isPasswordWithinUtf8ByteLimit(value);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must not exceed ${USER_PASSWORD_MAX_UTF8_BYTES} bytes when encoded as UTF-8.`;
        },
      },
    });
  };
}
