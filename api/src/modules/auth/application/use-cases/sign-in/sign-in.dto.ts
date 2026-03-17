import { UserStatus } from '../../../../../common/models/enums';
import { SessionMetadata } from '../../../../../common/models/interfaces';

export interface SignInUseCaseDto {
  userId: string;
  email: string;
  status: UserStatus;
  sessionMetadata: SessionMetadata;
}
