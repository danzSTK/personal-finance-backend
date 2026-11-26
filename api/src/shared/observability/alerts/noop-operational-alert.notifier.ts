import { IOperationalAlertNotifier } from '@/shared/observability/contracts/operational-alert-notifier.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class NoopOperationalAlertNotifier implements IOperationalAlertNotifier {
  send(): Promise<void> {
    return Promise.resolve();
  }
}
