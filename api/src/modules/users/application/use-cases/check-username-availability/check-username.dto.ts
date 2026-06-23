export enum CheckUsernameAvailabilityReason {
  AVAILABLE = 'AVAILABLE', // Indica que o nome de usuário está disponível (Somente para não enviar vazio em caso de disponibilidade)
  INVALID_FORMAT = 'INVALID_FORMAT', // Adicionado para indicar que o formato do nome de usuário é inválido
  ALREADY_EXISTS = 'ALREADY_EXISTS', // Adicionado para indicar que o nome de usuário já está em uso
  INVALID = 'INVALID', // Adicionado para casos de erro não categorizados
}

export interface CheckUsernameAvailabilityUseCaseInput {
  username: string;
}

export interface CheckUsernameAvailabilityUseCaseOutput {
  reason: CheckUsernameAvailabilityReason;
  username: string;
  available: boolean;
}
