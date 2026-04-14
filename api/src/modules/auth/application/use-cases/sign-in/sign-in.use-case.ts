import { Injectable } from '@nestjs/common';
import { GenerateTokenUseCase } from '../generate-token/generate-token.use-case';
import { SignInUseCaseOutput, type SignInUseCaseInput } from './sign-in.dto';

@Injectable()
export class SignInUseCase {
  constructor(private readonly generateTokenUseCase: GenerateTokenUseCase) {}

  async execute(data: SignInUseCaseInput): Promise<SignInUseCaseOutput> {
    const { accessToken, refreshToken } = await this.generateTokenUseCase.execute({
      userId: data.userId,
      email: data.email,
      status: data.status,
      sessionMetadata: data.sessionMetadata,
    });
    return { accessToken, refreshToken };
  }
}
