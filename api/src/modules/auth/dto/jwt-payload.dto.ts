import { UserStatus } from '../../../domains/enums/user-status.enum';

export class JwtPayloadDto {
  sub: string;
  email: string | null;
  status: UserStatus;
}
