import { BadRequestException } from '@nestjs/common';
import { USER_EMAIL_MAX_LENGTH, USER_EMAIL_REGEX } from '../../../../common/models/constants';

export class Email {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(email: string): Email {
    const normalized = email.trim().toLowerCase();

    if (!normalized) {
      throw new BadRequestException('Email is Required');
    }

    if (!USER_EMAIL_REGEX.test(normalized)) {
      throw new BadRequestException('Invalid email format');
    }

    if (normalized.length > USER_EMAIL_MAX_LENGTH) {
      throw new BadRequestException(`Email must be at most ${USER_EMAIL_MAX_LENGTH} characters`);
    }

    return new Email(normalized);
  }

  get value(): string {
    return this._value;
  }

  equals(other: Email): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
