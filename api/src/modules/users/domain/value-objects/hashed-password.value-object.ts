import { BadRequestException } from '@nestjs/common';

export class HashedPassword {
  private _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static createFromHash(hashedPassword: string): HashedPassword {
    if (!hashedPassword || hashedPassword.trim() === '') {
      throw new BadRequestException('Hashed password is required');
    }

    return new HashedPassword(hashedPassword);
  }

  get value(): string {
    return this._value;
  }

  equals(other: HashedPassword): boolean {
    return this._value === other._value;
  }
}
