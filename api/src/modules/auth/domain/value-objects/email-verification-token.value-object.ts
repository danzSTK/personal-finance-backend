import { createHash, randomBytes } from 'node:crypto';

export class EmailVerificationToken {
  private constructor(private readonly rawValue: string) {}

  get value(): string {
    return this.rawValue;
  }

  get hash(): string {
    return EmailVerificationToken.hash(this.rawValue);
  }

  static generate(): EmailVerificationToken {
    return new EmailVerificationToken(randomBytes(32).toString('base64url'));
  }

  static fromRaw(value: string): EmailVerificationToken {
    return new EmailVerificationToken(value.trim());
  }

  static hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
