import { CircuitBreakerService } from '@/shared/circuit-breaker/circuit-breaker.service';
import { Module } from '@nestjs/common';

@Module({
  providers: [CircuitBreakerService],
  exports: [CircuitBreakerService],
})
export class CircuitBreakerModule {}
