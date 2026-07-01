export interface ConfirmEmailVerificationUseCaseInput {
  token: string;
}

export interface ConfirmEmailVerificationUseCaseOutput {
  status: 'VERIFIED';
}
