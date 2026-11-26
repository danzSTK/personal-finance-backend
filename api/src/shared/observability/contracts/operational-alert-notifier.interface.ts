import { type OperationalAlertSeverity } from '@/shared/observability/constants/observability.constants';

export const OPERATIONAL_ALERT_NOTIFIER = Symbol('OPERATIONAL_ALERT_NOTIFIER');

export type { OperationalAlertSeverity };

export interface OperationalAlertInput {
  alertKey: string;
  event: string;
  severity: OperationalAlertSeverity;
  title: string;
  summary: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
  cooldownSeconds?: number;
  requestId?: string;
  jobId?: string;
}

export interface FormattedOperationalAlert extends OperationalAlertInput {
  environment: string;
  processRole: string;
  timestamp: string;
}

export interface IOperationalAlertNotifier {
  send(alert: FormattedOperationalAlert): Promise<void>;
}
