import { UserStatus } from '../../../common/models/enums/user-status.enum';

export class JwtPayloadDto {
  sub: string; // User ID
  email: string | null;
  status: UserStatus;
}
