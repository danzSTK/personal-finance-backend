import { SessionMetadata } from '../../../../../common/models/interfaces';
import { User } from '../../../../users/domain/entities/user.entity';

export interface SignUpUseCaseInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  userName: string;
  sessionMetadata: SessionMetadata;
}

export interface SignUpUseCaseOutput {
  accessToken: string;
  refreshToken: string;
  user: User;
}
