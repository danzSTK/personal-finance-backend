import {
  ObservabilityLogEvents,
  ObservabilityMetricTypes,
} from '@/shared/observability/constants/observability.constants';
import { StructuredLogMetricsRecorder } from '@/shared/observability/metrics/structured-log-metrics.recorder';
import { Logger } from '@nestjs/common';

describe('StructuredLogMetricsRecorder', () => {
  let recorder: StructuredLogMetricsRecorder;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    recorder = new StructuredLogMetricsRecorder();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('incrementCounter', () => {
    it('logs a structured counter metric with default value 1', () => {
      recorder.incrementCounter('nfce_import_total', { outcome: 'success' });

      expect(logSpy).toHaveBeenCalledWith({
        event: ObservabilityLogEvents.METRIC_RECORDED,
        metricType: ObservabilityMetricTypes.COUNTER,
        metricName: 'nfce_import_total',
        value: 1,
        labels: { outcome: 'success' },
      });
    });

    it('logs a structured counter metric with custom increment value', () => {
      recorder.incrementCounter('outbox_dispatched_total', undefined, 5);

      expect(logSpy).toHaveBeenCalledWith({
        event: ObservabilityLogEvents.METRIC_RECORDED,
        metricType: ObservabilityMetricTypes.COUNTER,
        metricName: 'outbox_dispatched_total',
        value: 5,
      });
    });

    it('never throws if logger throws an error', () => {
      logSpy.mockImplementationOnce(() => {
        throw new Error('Logger transport failure');
      });

      expect(() => recorder.incrementCounter('broken_metric')).not.toThrow();
    });
  });

  describe('observeDuration', () => {
    it('logs a structured histogram metric with durationMs and labels', () => {
      recorder.observeDuration('sefaz_scrape_duration_ms', 342, { status: 'ok' });

      expect(logSpy).toHaveBeenCalledWith({
        event: ObservabilityLogEvents.METRIC_RECORDED,
        metricType: ObservabilityMetricTypes.HISTOGRAM,
        metricName: 'sefaz_scrape_duration_ms',
        value: 342,
        labels: { status: 'ok' },
      });
    });

    it('never throws if logger throws an error', () => {
      logSpy.mockImplementationOnce(() => {
        throw new Error('Logger transport failure');
      });

      expect(() => recorder.observeDuration('broken_histogram', 100)).not.toThrow();
    });
  });
});
