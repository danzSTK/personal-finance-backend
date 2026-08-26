import { getEmailVerificationConfigInvariantError } from '@/config/config.module';

describe('Email verification configuration invariants', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts a token TTL that preserves cooldown and five useful minutes', () => {
    expect(getEmailVerificationConfigInvariantError({ EMAIL_VERIFICATION_TOKEN_TTL_MINUTES: 15 })).toBeNull();
  });

  it('rejects a token TTL shorter than the required 900 seconds', () => {
    expect(getEmailVerificationConfigInvariantError({ EMAIL_VERIFICATION_TOKEN_TTL_MINUTES: 14 })).toContain(
      'at least 900 seconds',
    );
  });
});
