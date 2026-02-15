import { Request } from 'express';
import { AUTH_CONSTANTS } from '../constants';
import { User } from '@/modules/users/entities/user.entity';

export interface AuthRequest extends Request {
  user?: User;
  cookies: {
    [AUTH_CONSTANTS.cookies.refreshTokenKey]?: string;
  };
}
