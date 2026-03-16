import { Injectable } from '@nestjs/common';
import { GenerateTokenUseCase } from '../generate-token/generate-token.use-case';
import { type GenerateTokenResult } from '../generate-token/generate-token.dto';
import { type SignInUseCaseDto } from './sign-in.dto';

@Injectable()
export class SignInUseCase {
  constructor(private readonly generateTokenUseCase: GenerateTokenUseCase) {}

  async execute(data: SignInUseCaseDto): Promise<GenerateTokenResult> {
    return this.generateTokenUseCase.execute({
      userId: data.userId,
      email: data.email,
      status: data.status,
      sessionMetadata: data.sessionMetadata,
    });
  }
}
