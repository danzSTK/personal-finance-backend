import { BadRequestException } from '@nestjs/common';
import { USER_NAME_MAX_LENGTH, USER_NAME_MIN_LENGTH, USER_NAME_REGEX } from '../../../../common/models/constants/index';

export class UserName {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(userName: string): UserName {
    const normalized = userName.trim().toLowerCase();

    if (!normalized) {
      throw new BadRequestException('Username is required');
    }

    if (normalized.length < USER_NAME_MIN_LENGTH) {
      throw new BadRequestException(`Username must be at least ${USER_NAME_MIN_LENGTH} characters long`);
    }

    if (normalized.length > USER_NAME_MAX_LENGTH) {
      throw new BadRequestException(`Username must be at most ${USER_NAME_MAX_LENGTH} characters long`);
    }

    if (!USER_NAME_REGEX.test(normalized)) {
      throw new BadRequestException('Username can only contain letters, numbers, and underscores');
    }

    return new UserName(normalized);
  }

  get value(): string {
    return this._value;
  }

  equals(other: UserName): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
