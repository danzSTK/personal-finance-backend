import { Session, SessionProps } from '../entities/session.entity';

export class SessionFactory {
  static create(props: SessionProps): Session {
    return Session.create(props);
  }
}
