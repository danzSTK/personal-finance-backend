import { AccountsModule } from '@/modules/accounts/accounts.module';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { TransactionReferenceValidator } from '@/modules/transactions/application/services/transaction-reference-validator.service';
import { ConfirmTransactionUseCase } from '@/modules/transactions/application/use-cases/confirm-transaction/confirm-transaction.use-case';
import { CreateTransactionUseCase } from '@/modules/transactions/application/use-cases/create-transaction/create-transaction.use-case';
import { DeleteTransactionUseCase } from '@/modules/transactions/application/use-cases/delete-transaction/delete-transaction.use-case';
import { GetTransactionUseCase } from '@/modules/transactions/application/use-cases/get-transaction/get-transaction.use-case';
import { ListTransactionsUseCase } from '@/modules/transactions/application/use-cases/list-transactions/list-transactions.use-case';
import { UpdateTransactionUseCase } from '@/modules/transactions/application/use-cases/update-transaction/update-transaction.use-case';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { TransactionRepository } from '@/modules/transactions/infrastructure/persistence/transaction.repository';
import { TransactionOrmEntity } from '@/modules/transactions/infrastructure/persistence/transaction-orm.entity';
import { TransactionsController } from '@/modules/transactions/presentation/http/transactions.controller';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([TransactionOrmEntity]), AccountsModule, CategoriesModule],
  controllers: [TransactionsController],
  providers: [
    {
      provide: ITransactionRepository,
      useClass: TransactionRepository,
    },
    TransactionReferenceValidator,
    CreateTransactionUseCase,
    ListTransactionsUseCase,
    GetTransactionUseCase,
    UpdateTransactionUseCase,
    ConfirmTransactionUseCase,
    DeleteTransactionUseCase,
  ],
  exports: [
    ITransactionRepository,
    CreateTransactionUseCase,
    ListTransactionsUseCase,
    GetTransactionUseCase,
    UpdateTransactionUseCase,
    ConfirmTransactionUseCase,
    DeleteTransactionUseCase,
  ],
})
export class TransactionsModule {}
