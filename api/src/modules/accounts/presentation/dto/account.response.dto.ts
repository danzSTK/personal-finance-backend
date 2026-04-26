import { ApiProperty } from '@nestjs/swagger';
import { AccountType } from '@/common/models/enums/account-type.enum';
import { Account } from '@/modules/accounts/domain/entities/account.entity';

export class AccountResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: AccountType })
  type: AccountType;

  @ApiProperty()
  initialBalance: number;

  @ApiProperty({ nullable: true })
  color: string | null;

  @ApiProperty({ nullable: true })
  icon: string | null;

  @ApiProperty()
  includeInTotal: boolean;

  @ApiProperty()
  isArchived: boolean;

  @ApiProperty()
  isDefault: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;

  static fromDomain(account: Account): AccountResponseDto {
    return {
      id: account.id,
      name: account.name,
      type: account.type,
      initialBalance: account.initialBalance,
      color: account.color,
      icon: account.icon,
      includeInTotal: account.includeInTotal,
      isArchived: account.isArchived,
      isDefault: account.isDefault,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }
}
