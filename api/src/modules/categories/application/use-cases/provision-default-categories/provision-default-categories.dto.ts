export interface ProvisionDefaultCategoriesUseCaseInput {
  userId: string;
}

export interface ProvisionDefaultCategoriesUseCaseOutput {
  created: number;
  skipped: number;
}
