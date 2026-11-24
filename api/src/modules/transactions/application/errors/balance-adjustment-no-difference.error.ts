import { ApplicationError } from '@/shared/application';

export class BalanceAdjustmentNoDifferenceError extends ApplicationError {
  readonly code = 'BALANCE_ADJUSTMENT_NO_DIFFERENCE';

  constructor(message = 'Account balance already matches the target balance.') {
    super(message);
  }
}
