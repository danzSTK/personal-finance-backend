import type { CircuitBreakerState } from '@/shared/circuit-breaker/constants/circuit-breaker.constants';

export interface CircuitBreakerOptions {
  key: string;
  failureThreshold: number;
  cooldownSeconds: readonly number[];
  stateTtlSeconds?: number;
  probeLockTtlSeconds?: number;
}

export interface CircuitBreakerDecision {
  allowed: boolean;
  state: CircuitBreakerState;
  retryAfterSeconds?: number;
  transitionedTo?: CircuitBreakerState;
}

export interface CircuitBreakerSuccessResult {
  previousState: CircuitBreakerState;
  currentState: CircuitBreakerState;
  closedFromHalfOpen: boolean;
}

export interface CircuitBreakerFailureResult {
  previousState: CircuitBreakerState;
  currentState: CircuitBreakerState;
  opened: boolean;
  retryAfterSeconds?: number;
  consecutiveFailures: number;
  cooldownStage: number;
}

export interface CircuitBreakerStateRecord {
  state: CircuitBreakerState;
  consecutiveFailures: number;
  cooldownStage: number;
  openedAtMs: number | null;
  nextAttemptAtMs: number | null;
}
