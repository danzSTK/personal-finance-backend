export const METRICS_RECORDER = Symbol('METRICS_RECORDER');

export type MetricLabels = Record<string, string | number | boolean>;

export interface IMetricsRecorder {
  incrementCounter(name: string, labels?: MetricLabels, value?: number): void;
  observeDuration(name: string, durationMs: number, labels?: MetricLabels): void;
}
