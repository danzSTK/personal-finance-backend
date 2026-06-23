import { ApplicationError } from '@/shared/application';

export class PotentialSessionHijackingError extends ApplicationError {
  readonly code = 'POTENTIAL_SESSION_HIJACKING';

  constructor(message = 'Potential session hijacking detected.') {
    super(message);
  }
}
