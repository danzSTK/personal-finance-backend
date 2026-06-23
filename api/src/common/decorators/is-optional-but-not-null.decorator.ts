import { NotEquals, ValidateIf, type ValidationOptions } from 'class-validator';

export function IsOptionalButNotNull(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    ValidateIf((_obj, value) => value !== undefined)(target, propertyKey as string);
    NotEquals(null, {
      message: `${propertyKey.toString()} cannot be null`,
      ...validationOptions,
    })(target, propertyKey as string);
  };
}
