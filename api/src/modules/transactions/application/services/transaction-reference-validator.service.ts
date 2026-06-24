import { CategoryType, TransactionType } from '@/common/models/enums';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { Category } from '@/modules/categories/domain/entities/category.entity';
import { ICategoryRepository } from '@/modules/categories/domain/repositories/category.repository.interface';
import {
  TransactionAccountUnavailableError,
  TransactionCategoryIncompatibleError,
  TransactionCategoryUnavailableError,
} from '@/modules/transactions/application/errors';
import { Injectable } from '@nestjs/common';

interface ValidateTransactionReferencesInput {
  userId: string;
  accountId: string;
  destinationAccountId: string | null;
  categoryId?: string;
  type: TransactionType;
}

export interface ValidatedTransactionReferences {
  account: Account;
  destinationAccount: Account | null;
  category: Category;
}

const CATEGORY_TYPE_BY_TRANSACTION_TYPE: Record<TransactionType, CategoryType> = {
  [TransactionType.INCOME]: CategoryType.INCOME,
  [TransactionType.EXPENSE]: CategoryType.EXPENSE,
  [TransactionType.TRANSFER]: CategoryType.TRANSFER,
  [TransactionType.ADJUSTMENT]: CategoryType.ADJUSTMENT,
};

@Injectable()
export class TransactionReferenceValidator {
  constructor(
    private readonly accountRepository: IAccountRepository,
    private readonly categoryRepository: ICategoryRepository,
  ) {}

  async validate(input: ValidateTransactionReferencesInput): Promise<ValidatedTransactionReferences> {
    const account = await this.accountRepository.findByIdAndUserId(input.accountId, input.userId);

    if (!account || account.isArchived) {
      throw new TransactionAccountUnavailableError('Transaction account does not exist or is archived.');
    }

    const destinationAccount = await this.resolveDestinationAccount(input);
    const category = await this.resolveCategory(input);

    return {
      account,
      destinationAccount,
      category,
    };
  }

  private async resolveDestinationAccount(input: ValidateTransactionReferencesInput): Promise<Account | null> {
    if (input.type !== TransactionType.TRANSFER) {
      return null;
    }

    if (!input.destinationAccountId) {
      throw new TransactionAccountUnavailableError('Transfer transaction must have destination account.');
    }

    const destinationAccount = await this.accountRepository.findByIdAndUserId(input.destinationAccountId, input.userId);

    if (!destinationAccount || destinationAccount.isArchived) {
      throw new TransactionAccountUnavailableError('Transfer destination account does not exist or is archived.');
    }

    // transferência não pode ser para a mesma conta
    if (input.accountId === input.destinationAccountId) {
      throw new TransactionAccountUnavailableError('Transfer origin and destination accounts must be different.');
    }

    return destinationAccount;
  }

  private async resolveCategory(input: ValidateTransactionReferencesInput): Promise<Category> {
    const expectedCategoryType = CATEGORY_TYPE_BY_TRANSACTION_TYPE[input.type];
    const category = Category.isTechnicalType(expectedCategoryType)
      ? await this.categoryRepository.findActiveSystemByType(input.userId, expectedCategoryType)
      : await this.resolveUserCategory(input, expectedCategoryType);

    if (!category || category.isArchived) {
      throw new TransactionCategoryUnavailableError('Transaction category does not exist or is archived.');
    }

    if (category.type !== expectedCategoryType) {
      throw new TransactionCategoryIncompatibleError(
        `Transaction type ${input.type} requires category type ${expectedCategoryType}.`,
      );
    }

    return category;
  }

  private async resolveUserCategory(
    input: ValidateTransactionReferencesInput,
    expectedCategoryType: CategoryType,
  ): Promise<Category | null> {
    if (!input.categoryId) {
      throw new TransactionCategoryUnavailableError('Transaction category is required.');
    }

    const category = await this.categoryRepository.findByIdAndUserId(input.categoryId, input.userId);

    if (!category) {
      return null;
    }

    if (category.isTechnical || category.isSystem) {
      throw new TransactionCategoryUnavailableError('Transaction category does not exist or is archived.');
    }

    if (category.type !== expectedCategoryType) {
      throw new TransactionCategoryIncompatibleError(
        `Transaction type ${input.type} requires category type ${expectedCategoryType}.`,
      );
    }

    return category;
  }
}
