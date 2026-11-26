import {
  ObservabilityLogEvents,
  type ObservabilityMetricType,
  ObservabilityMetricTypes,
} from '@/shared/observability/constants/observability.constants';
import { IMetricsRecorder, MetricLabels } from '@/shared/observability/contracts/metrics-recorder.interface';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class StructuredLogMetricsRecorder implements IMetricsRecorder {
  private readonly logger = new Logger(StructuredLogMetricsRecorder.name);

  incrementCounter(name: string, labels?: MetricLabels, value = 1): void {
    this.record({
      event: ObservabilityLogEvents.METRIC_RECORDED,
      metricType: ObservabilityMetricTypes.COUNTER,
      metricName: name,
      value,
      ...(labels ? { labels } : {}),
    });
  }

  observeDuration(name: string, durationMs: number, labels?: MetricLabels): void {
    this.record({
      event: ObservabilityLogEvents.METRIC_RECORDED,
      metricType: ObservabilityMetricTypes.HISTOGRAM,
      metricName: name,
      value: durationMs,
      ...(labels ? { labels } : {}),
    });
  }

  private record(payload: {
    event: typeof ObservabilityLogEvents.METRIC_RECORDED;
    metricType: ObservabilityMetricType;
    metricName: string;
    value: number;
    labels?: MetricLabels;
  }): void {
    try {
      this.logger.log(payload);
    } catch {
      // Metrics recording must never break caller execution
    }
  }
}
