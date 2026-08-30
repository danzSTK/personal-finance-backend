import { ApiProperty } from '@nestjs/swagger';
import { RESPONSE_OBJECT_TYPES } from '@/common/models/constants';
import { AccountType } from '@/common/models/enums/account-type.enum';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { AccountBalanceSummary } from '@/modules/accounts/domain/repositories/account-balance.repository.interface';
import { AccountTemplateResponseDto } from './account-template.response.dto';

class AccountBalanceResponseDto {
  @ApiProperty()
  currentCents: number;

  @ApiProperty({ required: false })
  projectedCents?: number;

  @ApiProperty({ required: false, format: 'date' })
  projectedUntil?: string;
}

export class AccountResponseDto {
  @ApiProperty({ example: RESPONSE_OBJECT_TYPES.ACCOUNT_ITEM })
  object: typeof RESPONSE_OBJECT_TYPES.ACCOUNT_ITEM;

  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: AccountType })
  type: AccountType;

  @ApiProperty()
  initialBalanceCents: number;

  @ApiProperty({ nullable: true, format: 'uuid' })
  templateId: string | null;

  @ApiProperty({ nullable: true, type: AccountTemplateResponseDto })
  template: AccountTemplateResponseDto | null;

  @ApiProperty({ nullable: true, deprecated: true })
  color: string | null;

  @ApiProperty({ nullable: true, deprecated: true })
  icon: string | null;

  @ApiProperty()
  includeInTotal: boolean;

  @ApiProperty()
  isArchived: boolean;

  @ApiProperty()
  isDefault: boolean;

  @ApiProperty({ type: AccountBalanceResponseDto, required: false })
  balance?: AccountBalanceResponseDto;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;

  static fromDomain(
    account: Account,
    balance?: AccountBalanceSummary,
    template: AccountTemplateResponseDto | null = null,
  ): AccountResponseDto {
    return {
      object: RESPONSE_OBJECT_TYPES.ACCOUNT_ITEM,
      id: account.id,
      name: account.name,
      type: account.type,
      initialBalanceCents: account.initialBalanceCents,
      templateId: account.templateId,
      template,
      color: account.color,
      icon: account.icon,
      includeInTotal: account.includeInTotal,
      isArchived: account.isArchived,
      isDefault: account.isDefault,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      balance: balance ? AccountResponseDto.toBalanceResponse(balance) : undefined,
    };
  }

  private static toBalanceResponse(balance: AccountBalanceSummary): AccountBalanceResponseDto {
    return {
      currentCents: balance.currentCents,
      projectedCents: balance.projectedCents,
      projectedUntil: balance.projectedUntil,
    };
  }
}
