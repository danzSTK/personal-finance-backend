import { AppExceptionFilter } from '@/common/filters';
import { createValidationException } from '@/common/validation';
import { AccountTemplateInputConflictError } from '@/modules/accounts/application/errors';
import { ArchiveAccountUseCase } from '@/modules/accounts/application/use-cases/archive-account/archive-account.use-case';
import { CreateAccountUseCase } from '@/modules/accounts/application/use-cases/create-account/create-account.use-case';
import { GetAccountSummaryUseCase } from '@/modules/accounts/application/use-cases/get-account-summary/get-account-summary.use-case';
import { ListAccountTemplatesUseCase } from '@/modules/accounts/application/use-cases/list-account-templates/list-account-templates.use-case';
import { ListAccountsUseCase } from '@/modules/accounts/application/use-cases/list-accounts/list-accounts.use-case';
import { SetDefaultAccountUseCase } from '@/modules/accounts/application/use-cases/set-default-account/set-default-account.use-case';
import { UnarchiveAccountUseCase } from '@/modules/accounts/application/use-cases/unarchive-account/unarchive-account.use-case';
import { UpdateAccountUseCase } from '@/modules/accounts/application/use-cases/update-account/update-account.use-case';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { AccountTemplate } from '@/modules/accounts/domain/entities/account-template.entity';
import { ACCOUNT_TEMPLATE_TYPE } from '@/modules/accounts/domain/enums/account-template-type.enum';
import { AccountTemplatesController } from '@/modules/accounts/presentation/http/account-templates.controller';
import { AccountsController } from '@/modules/accounts/presentation/http/accounts.controller';
import { AccountTemplateResponseAssembler } from '@/modules/accounts/presentation/services/account-template-response.assembler';
import { AccountType, ColorToken, IconKey } from '@/common/models/enums';
import { CanActivate, ExecutionContext, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

class TestSessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const httpRequest = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: { id: string };
    }>();
    const authorization = httpRequest.headers.authorization;

    if (authorization !== 'Bearer account-template-test') {
      throw new UnauthorizedException('Session is missing or invalid.');
    }

    httpRequest.user = { id: '7959495d-7c8a-451d-b308-da032c20e615' };
    return true;
  }
}

describe('Account templates HTTP contract (e2e)', () => {
  let app: INestApplication;
  const execute = jest.fn();
  const createAccountExecute = jest.fn<
    ReturnType<CreateAccountUseCase['execute']>,
    Parameters<CreateAccountUseCase['execute']>
  >();
  const updateAccountExecute = jest.fn<
    ReturnType<UpdateAccountUseCase['execute']>,
    Parameters<UpdateAccountUseCase['execute']>
  >();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AccountTemplatesController, AccountsController],
      providers: [
        { provide: ListAccountTemplatesUseCase, useValue: { execute } },
        { provide: CreateAccountUseCase, useValue: { execute: createAccountExecute } },
        { provide: UpdateAccountUseCase, useValue: { execute: updateAccountExecute } },
        { provide: ListAccountsUseCase, useValue: { execute: jest.fn() } },
        { provide: GetAccountSummaryUseCase, useValue: { execute: jest.fn() } },
        { provide: ArchiveAccountUseCase, useValue: { execute: jest.fn() } },
        { provide: SetDefaultAccountUseCase, useValue: { execute: jest.fn() } },
        { provide: UnarchiveAccountUseCase, useValue: { execute: jest.fn() } },
        {
          provide: AccountTemplateResponseAssembler,
          useValue: {
            toDto: (template: AccountTemplate) => ({
              object: 'account_template.item',
              id: template.id,
              type: template.type,
              name: template.name,
              colorToken: template.colorToken,
              iconKey: template.iconKey,
              logoUrl: 'https://public.example/banking-institutions-icons/nubank.svg',
              bankCode: template.bankCode,
              ispb: template.ispb,
            }),
          },
        },
        { provide: APP_GUARD, useClass: TestSessionGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new AppExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        exceptionFactory: createValidationException,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    const institutional = nubankTemplate();
    const custom = customTemplate();
    execute.mockResolvedValue([institutional]);
    createAccountExecute.mockResolvedValue({
      account: accountWithTemplate(institutional, 'Conta Nubank'),
      template: institutional,
    });
    updateAccountExecute.mockResolvedValue({
      account: accountWithTemplate(custom, 'Conta personalizada'),
      template: custom,
    });
  });

  it('rejects requests without an authenticated session', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(httpServer).get('/account-templates').expect(401);

    expect(response.body).toEqual(
      expect.objectContaining({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        path: '/account-templates',
      }),
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it('returns the public institutional contract without storage or ownership fields', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(httpServer)
      .get('/account-templates')
      .set('Authorization', 'Bearer account-template-test')
      .expect(200);

    expect(response.body).toEqual([
      {
        object: 'account_template.item',
        id: '54066cca-075e-4300-923b-f5b36462aa1f',
        type: 'INSTITUTIONAL',
        name: 'Nubank',
        colorToken: 'nubank',
        iconKey: null,
        logoUrl: 'https://public.example/banking-institutions-icons/nubank.svg',
        bankCode: 260,
        ispb: '18236120',
      },
    ]);
    expect(JSON.stringify(response.body)).not.toContain('logoStorageKey');
    expect(JSON.stringify(response.body)).not.toContain('ownerUserId');
  });

  it('accepts the new institutional object on POST and forwards the discriminated command', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];

    await request(httpServer)
      .post('/accounts')
      .set('Authorization', 'Bearer account-template-test')
      .send({
        name: 'Conta Nubank',
        type: AccountType.BANK,
        template: {
          type: 'institutional',
          templateId: '54066cca-075e-4300-923b-f5b36462aa1f',
        },
      })
      .expect(201);

    expect(createAccountExecute).toHaveBeenCalledWith({
      userId: '7959495d-7c8a-451d-b308-da032c20e615',
      name: 'Conta Nubank',
      type: AccountType.BANK,
      initialBalanceCents: undefined,
      template: {
        type: 'institutional',
        templateId: '54066cca-075e-4300-923b-f5b36462aa1f',
      },
      color: undefined,
      icon: undefined,
      includeInTotal: undefined,
      isDefault: undefined,
    });
  });

  it('accepts a partial custom object on PATCH', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];

    await request(httpServer)
      .patch('/accounts/5f6b18c6-1fd9-4e8f-99a8-4a7b65ef56e2')
      .set('Authorization', 'Bearer account-template-test')
      .send({
        template: {
          type: 'custom',
          colorToken: ColorToken.PURPLE,
        },
      })
      .expect(200);

    expect(updateAccountExecute).toHaveBeenCalledWith({
      userId: '7959495d-7c8a-451d-b308-da032c20e615',
      accountId: '5f6b18c6-1fd9-4e8f-99a8-4a7b65ef56e2',
      patch: {
        template: {
          type: 'custom',
          colorToken: ColorToken.PURPLE,
        },
      },
    });
  });

  it('rejects the superseded root templateId field', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(httpServer)
      .post('/accounts')
      .set('Authorization', 'Bearer account-template-test')
      .send({
        name: 'Conta Nubank',
        type: AccountType.BANK,
        templateId: '54066cca-075e-4300-923b-f5b36462aa1f',
      })
      .expect(400);

    expect(response.body).toEqual(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    expect(createAccountExecute).not.toHaveBeenCalled();
  });

  it('exposes the stable conflict error when template is combined with legacy fields', async () => {
    createAccountExecute.mockRejectedValueOnce(new AccountTemplateInputConflictError());
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(httpServer)
      .post('/accounts')
      .set('Authorization', 'Bearer account-template-test')
      .send({
        name: 'Conta Nubank',
        type: AccountType.BANK,
        template: {
          type: 'institutional',
          templateId: '54066cca-075e-4300-923b-f5b36462aa1f',
        },
        color: ColorToken.PURPLE,
      })
      .expect(400);

    expect(response.body).toEqual(expect.objectContaining({ code: 'ACCOUNT_TEMPLATE_INPUT_CONFLICT' }));
  });
});

function nubankTemplate(): AccountTemplate {
  const now = new Date('2026-08-29T00:00:00.000Z');
  return AccountTemplate.reconstitute(
    {
      type: ACCOUNT_TEMPLATE_TYPE.INSTITUTIONAL,
      ownerUserId: null,
      catalogKey: 'nubank',
      name: 'Nubank',
      colorToken: 'nubank',
      iconKey: null,
      logoStorageKey: 'banking-institutions-icons/nubank.svg',
      bankCode: 260,
      ispb: '18236120',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    '54066cca-075e-4300-923b-f5b36462aa1f',
  );
}

function customTemplate(): AccountTemplate {
  const now = new Date('2026-08-29T00:00:00.000Z');
  return AccountTemplate.reconstitute(
    {
      type: ACCOUNT_TEMPLATE_TYPE.CUSTOM,
      ownerUserId: '7959495d-7c8a-451d-b308-da032c20e615',
      catalogKey: null,
      name: 'Conta personalizada',
      colorToken: ColorToken.PURPLE,
      iconKey: IconKey.WALLET,
      logoStorageKey: null,
      bankCode: null,
      ispb: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    '0795ab53-402f-4754-a5b3-f7449338a2e9',
  );
}

function accountWithTemplate(template: AccountTemplate, name: string): Account {
  const now = new Date('2026-08-29T00:00:00.000Z');
  return Account.reconstitute(
    {
      userId: '7959495d-7c8a-451d-b308-da032c20e615',
      name,
      type: AccountType.BANK,
      initialBalanceCents: 0,
      templateId: template.id,
      color: template.colorToken,
      icon: template.type === ACCOUNT_TEMPLATE_TYPE.INSTITUTIONAL ? IconKey.LANDMARK : template.iconKey,
      includeInTotal: true,
      isArchived: false,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    },
    '5f6b18c6-1fd9-4e8f-99a8-4a7b65ef56e2',
  );
}
