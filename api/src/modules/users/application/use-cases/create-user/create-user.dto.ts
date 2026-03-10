import { UserStatus } from '../../../../../common/models/enums';

export interface CreateUserUseCaseDto {
  userName?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  status: UserStatus;
}
