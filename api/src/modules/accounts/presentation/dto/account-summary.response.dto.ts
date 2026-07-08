import { RESPONSE_OBJECT_TYPES } from '@/common/models/constants';
import { AccountSummary } from '@/modules/accounts/domain/repositories/account-balance.repository.interface';
import { ApiProperty } from '@nestjs/swagger';

export class AccountSummaryResponseDto {
  @ApiProperty({ example: RESPONSE_OBJECT_TYPES.ACCOUNT_SUMMARY })
  object: typeof RESPONSE_OBJECT_TYPES.ACCOUNT_SUMMARY;

  @ApiProperty({ example: 250000 })
  currentCents: number;

  @ApiProperty({ required: false, example: 210000 })
  projectedCents?: number;

  @ApiProperty({ required: false, format: 'date', example: '2026-06-30' })
  projectedUntil?: string;

  static fromUseCaseOutput(output: AccountSummary): AccountSummaryResponseDto {
    return {
      object: RESPONSE_OBJECT_TYPES.ACCOUNT_SUMMARY,
      currentCents: output.currentCents,
      projectedCents: output.projectedCents,
      projectedUntil: output.projectedUntil,
    };
  }
}
