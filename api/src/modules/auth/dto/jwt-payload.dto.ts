import { UserStatus } from '../../../common/models/enums/user-status.enum';

export class JwtPayloadDto {
  jti: string;
  sub: string; // User ID
  email: string | null;
  status: UserStatus;

  exp?: number;
  iat?: number;
}
