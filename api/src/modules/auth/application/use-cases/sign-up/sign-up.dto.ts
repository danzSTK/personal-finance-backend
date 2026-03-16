import { SessionMetadata } from '../../../../../common/models/interfaces';

export interface SignUpUseCaseDto {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  userName: string;
  sessionMetadata: SessionMetadata;
}
