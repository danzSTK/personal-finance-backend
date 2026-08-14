import { User } from '@/modules/users/domain/entities/user.entity';
import { Request } from 'express';
import { AUTH_CONSTANTS } from '../constants';

export interface AuthRequest extends Request {
  user?: User;
  authToken?: {
    jti: string;
    sub: string;
    credentialVersion?: number;
  };
  cookies: {
    [AUTH_CONSTANTS.cookies.refreshTokenKey]?: string;
    [AUTH_CONSTANTS.cookies.accessTokenKey]?: string;
  };
}
