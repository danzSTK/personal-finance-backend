import { isValidDateOnly } from '@/common/utils/date-only';
import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

export function IsDateOnly(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target, propertyName) => {
    registerDecorator({
      name: 'isDateOnly',
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return isValidDateOnly(value);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be a valid date in YYYY-MM-DD format.`;
        },
      },
    });
  };
}
