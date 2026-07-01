export interface ResendEmailVerificationUseCaseInput {
  userId: string;
}

export interface ResendEmailVerificationUseCaseOutput {
  status: 'QUEUED' | 'ALREADY_VERIFIED';
}
