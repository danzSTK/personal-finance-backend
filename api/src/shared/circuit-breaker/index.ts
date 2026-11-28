export { CircuitBreakerModule } from './circuit-breaker.module';
export { CircuitBreakerService } from './circuit-breaker.service';
export {
  CIRCUIT_BREAKER_PROBE_KEY_SUFFIX,
  CIRCUIT_BREAKER_PROBE_LOCK_VALUE,
  CIRCUIT_BREAKER_REDIS_SET_OK,
  CircuitBreakerLogEvents,
  CircuitBreakerStates,
  DEFAULT_CIRCUIT_BREAKER_COOLDOWN_SECONDS,
  DEFAULT_CIRCUIT_BREAKER_FAILURE_THRESHOLD,
  DEFAULT_CIRCUIT_BREAKER_PROBE_LOCK_TTL_SECONDS,
  DEFAULT_CIRCUIT_BREAKER_STATE_TTL_SECONDS,
  type CircuitBreakerState,
} from './constants/circuit-breaker.constants';
export type {
  CircuitBreakerDecision,
  CircuitBreakerFailureResult,
  CircuitBreakerOptions,
  CircuitBreakerStateRecord,
  CircuitBreakerSuccessResult,
} from './contracts/circuit-breaker.interface';
