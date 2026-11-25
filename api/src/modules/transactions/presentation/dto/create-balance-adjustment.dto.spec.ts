import { createValidationException } from '@/common/validation';
import { CreateBalanceAdjustmentDto } from '@/modules/transactions/presentation/dto/create-balance-adjustment.dto';
import { BadRequestException, ValidationPipe } from '@nestjs/common';

describe('CreateBalanceAdjustmentDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
    exceptionFactory: createValidationException,
  });

  const validBase = {
    accountId: 'a6e1a79f-6fbd-441d-93b7-458de6cf1f35',
    targetBalanceCents: 100000,
    date: '2026-06-23',
  };

  const validate = (payload: Record<string, unknown>) =>
    pipe.transform(payload, {
      type: 'body',
      metatype: CreateBalanceAdjustmentDto,
    }) as Promise<CreateBalanceAdjustmentDto>;

  it('accepts positive, zero and negative integer targetBalanceCents', async () => {
    await expect(validate({ ...validBase, targetBalanceCents: 5000 })).resolves.toMatchObject({
      targetBalanceCents: 5000,
    });
    await expect(validate({ ...validBase, targetBalanceCents: 0 })).resolves.toMatchObject({
      targetBalanceCents: 0,
    });
    await expect(validate({ ...validBase, targetBalanceCents: -25050 })).resolves.toMatchObject({
      targetBalanceCents: -25050,
    });
  });

  it('accepts omitted, null and custom description', async () => {
    await expect(validate(validBase)).resolves.toMatchObject({
      accountId: validBase.accountId,
      targetBalanceCents: 100000,
      date: '2026-06-23',
    });
    await expect(validate({ ...validBase, description: null })).resolves.toMatchObject({
      description: null,
    });
    await expect(validate({ ...validBase, description: 'Conciliação' })).resolves.toMatchObject({
      description: 'Conciliação',
    });
  });

  it('rejects null, empty string, boolean and non-integer targetBalanceCents without implicit coercion to 0/1', async () => {
    await expect(validate({ ...validBase, targetBalanceCents: null })).rejects.toThrow(BadRequestException);
    await expect(validate({ ...validBase, targetBalanceCents: '' })).rejects.toThrow(BadRequestException);
    await expect(validate({ ...validBase, targetBalanceCents: false })).rejects.toThrow(BadRequestException);
    await expect(validate({ ...validBase, targetBalanceCents: true })).rejects.toThrow(BadRequestException);
    await expect(validate({ ...validBase, targetBalanceCents: '0' })).rejects.toThrow(BadRequestException);
    await expect(validate({ ...validBase, targetBalanceCents: 10.5 })).rejects.toThrow(BadRequestException);
  });

  it('rejects missing date, invalid date format and non-whitelisted fields', async () => {
    await expect(validate({ accountId: validBase.accountId, targetBalanceCents: 100 })).rejects.toThrow(
      BadRequestException,
    );
    await expect(validate({ ...validBase, date: '2026-06-23T00:00:00.000Z' })).rejects.toThrow(BadRequestException);
    await expect(validate({ ...validBase, userId: '11111111-1111-4111-a111-111111111111' })).rejects.toThrow(
      BadRequestException,
    );
  });
});
