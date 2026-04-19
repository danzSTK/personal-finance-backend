import { SessionMetadata } from '@/common/models/interfaces';

export interface SessionProps {
  userId: string;
  jti: string;
  metadata: SessionMetadata;
}

export class Session {
  private constructor(private readonly props: SessionProps) {}

  get userId(): string {
    return this.props.userId;
  }

  get jti(): string {
    return this.props.jti;
  }

  get metadata(): SessionMetadata {
    return this.props.metadata;
  }

  static create(props: SessionProps): Session {
    return new Session(props);
  }

  static reconstitute(props: SessionProps): Session {
    return new Session(props);
  }
}
