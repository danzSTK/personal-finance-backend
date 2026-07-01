import {
  EmailVerificationChallengeLimits,
  EmailVerificationPurpose,
} from '@/modules/auth/domain/constants/email-verification.constants';
import { InvalidEmailVerificationChallengeError } from '@/modules/auth/domain/errors/invalid-email-verification-challenge.error';

export interface EmailVerificationChallengeProps {
  userId: string;
  email: string;
  purpose: EmailVerificationPurpose;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export class EmailVerificationChallenge {
  private constructor(
    private readonly props: EmailVerificationChallengeProps,
    public readonly id: string,
  ) {}

  get userId(): string {
    return this.props.userId;
  }

  get email(): string {
    return this.props.email;
  }

  get purpose(): EmailVerificationPurpose {
    return this.props.purpose;
  }

  get tokenHash(): string {
    return this.props.tokenHash;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get consumedAt(): Date | null {
    return this.props.consumedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get isConsumed(): boolean {
    return this.props.consumedAt !== null;
  }

  isExpired(now = new Date()): boolean {
    return this.props.expiresAt.getTime() <= now.getTime();
  }

  consume(now = new Date()): void {
    if (this.props.consumedAt) {
      return;
    }

    if (this.isExpired(now)) {
      throw new InvalidEmailVerificationChallengeError('Cannot consume an expired email verification challenge.');
    }

    this.props.consumedAt = now;
  }

  static create(
    props: Omit<EmailVerificationChallengeProps, 'consumedAt' | 'createdAt'>,
    id: string,
  ): EmailVerificationChallenge {
    const challenge = new EmailVerificationChallenge(
      {
        ...props,
        consumedAt: null,
        createdAt: new Date(),
      },
      id,
    );

    challenge.validate();

    return challenge;
  }

  static reconstitute(props: EmailVerificationChallengeProps, id: string): EmailVerificationChallenge {
    return new EmailVerificationChallenge(props, id);
  }

  private validate(): void {
    this.ensureText(this.id, 'Email verification challenge id is required.');
    this.ensureText(this.props.userId, 'Email verification user id is required.');
    this.ensureText(this.props.email, 'Email verification email is required.');

    if (!this.props.email.includes('@')) {
      throw new InvalidEmailVerificationChallengeError('Email verification email must be valid.');
    }

    if (this.props.email.length > EmailVerificationChallengeLimits.emailMaxLength) {
      throw new InvalidEmailVerificationChallengeError('Email verification email is too long.');
    }

    if (this.props.purpose !== EmailVerificationPurpose.EMAIL_VERIFICATION) {
      throw new InvalidEmailVerificationChallengeError('Email verification purpose is invalid.');
    }

    if (!/^[a-f0-9]{64}$/.test(this.props.tokenHash)) {
      throw new InvalidEmailVerificationChallengeError('Email verification token hash is invalid.');
    }

    if (this.props.expiresAt.getTime() <= this.props.createdAt.getTime()) {
      throw new InvalidEmailVerificationChallengeError('Email verification expiration must be after creation.');
    }

    if (this.props.consumedAt && this.props.consumedAt.getTime() < this.props.createdAt.getTime()) {
      throw new InvalidEmailVerificationChallengeError('Email verification consumption cannot happen before creation.');
    }
  }

  private ensureText(value: string, message: string): void {
    if (!value.trim()) {
      throw new InvalidEmailVerificationChallengeError(message);
    }
  }
}
