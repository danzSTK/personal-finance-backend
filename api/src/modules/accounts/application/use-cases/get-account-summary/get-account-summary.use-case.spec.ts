import { DateOnlyString } from '@/common/utils/date-only';
import { IAccountBalanceRepository } from '@/modules/accounts/domain/repositories/account-balance.repository.interface';
import { Test, TestingModule } from '@nestjs/testing';
import { GetAccountSummaryUseCase } from './get-account-summary.use-case';

describe('GetAccountSummaryUseCase', () => {
  const userId = '5e37b15e-4f8e-494f-a5cd-31f53e773a74';
  let useCase: GetAccountSummaryUseCase;
  let accountBalanceRepository: jest.Mocked<Pick<IAccountBalanceRepository, 'getUserSummary'>>;

  beforeEach(async () => {
    jest.clearAllMocks();

    accountBalanceRepository = {
      getUserSummary: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetAccountSummaryUseCase,
        {
          provide: IAccountBalanceRepository,
          useValue: accountBalanceRepository,
        },
      ],
    }).compile();

    useCase = module.get(GetAccountSummaryUseCase);
  });

  describe('execute', () => {
    it('returns current summary with default filters', async () => {
      accountBalanceRepository.getUserSummary.mockResolvedValue({
        currentCents: 250000,
      });

      const output = await useCase.execute({ userId });

      expect(accountBalanceRepository.getUserSummary).toHaveBeenCalledWith({
        userId,
        includeArchived: false,
        includeExcludedFromTotal: false,
        projectedUntil: undefined,
      });
      expect(output).toEqual({
        currentCents: 250000,
      });
    });

    it('passes projection and account set filters to the repository', async () => {
      accountBalanceRepository.getUserSummary.mockResolvedValue({
        currentCents: 250000,
        projectedCents: 210000,
        projectedUntil: '2026-06-30' as DateOnlyString,
      });

      const output = await useCase.execute({
        userId,
        includeArchived: true,
        includeExcludedFromTotal: true,
        projectedUntil: '2026-06-30' as DateOnlyString,
      });

      expect(accountBalanceRepository.getUserSummary).toHaveBeenCalledWith({
        userId,
        includeArchived: true,
        includeExcludedFromTotal: true,
        projectedUntil: '2026-06-30',
      });
      expect(output).toEqual({
        currentCents: 250000,
        projectedCents: 210000,
        projectedUntil: '2026-06-30',
      });
    });
  });
});
