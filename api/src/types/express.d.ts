import { User as UserEntitiy } from '../modules/users/entities/user.entity';

declare global {
  namespace Express {
    interface Request {
      user?: UserEntitiy;
    }
  }
}
export {};
