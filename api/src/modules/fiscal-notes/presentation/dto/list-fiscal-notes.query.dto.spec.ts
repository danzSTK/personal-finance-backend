import { RESPONSE_OBJECT_TYPES } from '@/common/models/constants';
import {
  FiscalNoteListSort,
  FiscalNoteListSorts,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { ListFiscalNotesQueryDto } from '@/modules/fiscal-notes/presentation/dto/list-fiscal-notes.query.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('ListFiscalNotesQueryDto', () => {
  const transformAndValidate = async (raw: Record<string, unknown>) => {
    const dto = plainToInstance(ListFiscalNotesQueryDto, raw, { enableImplicitConversion: true });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    return { dto, errors };
  };

  it('normalizes masked issuerCnpj to 14 digits and trims sourceUf and search', async () => {
    const { dto, errors } = await transformAndValidate({
      issuedFrom: '2026-10-01',
      issuedTo: '2026-10-31',
      issuerCnpj: ' 03.539.462/0002-50 ',
      sourceUf: ' 23 ',
      minAmountCents: '100',
      maxAmountCents: '5000',
      search: '  QUEIJO  ',
      page: '2',
      limit: '50',
      sort: FiscalNoteListSorts.PAYABLE_AMOUNT_DESC,
    });

    expect(errors).toHaveLength(0);
    expect(dto.issuerCnpj).toBe('03539462000250');
    expect(dto.sourceUf).toBe('23');
    expect(dto.minAmountCents).toBe(100);
    expect(dto.maxAmountCents).toBe(5000);
    expect(dto.search).toBe('QUEIJO');
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
    expect(dto.sort).toBe(FiscalNoteListSorts.PAYABLE_AMOUNT_DESC);
  });

  it('turns empty numeric/string query params into undefined instead of 0', async () => {
    const { dto, errors } = await transformAndValidate({
      issuerCnpj: '   ',
      sourceUf: '',
      minAmountCents: '',
      maxAmountCents: '  ',
      search: '   ',
      page: '',
      limit: '',
    });

    expect(errors).toHaveLength(0);
    expect(dto.issuerCnpj).toBeUndefined();
    expect(dto.sourceUf).toBeUndefined();
    expect(dto.minAmountCents).toBeUndefined();
    expect(dto.maxAmountCents).toBeUndefined();
    expect(dto.search).toBeUndefined();
    expect(dto.page).toBeUndefined();
    expect(dto.limit).toBeUndefined();
    expect(RESPONSE_OBJECT_TYPES.FISCAL_NOTE_LIST).toBe('fiscal_note.list');
  });

  it('rejects issuerCnpj containing letters, invalid sourceUf, and invalid DateOnly', async () => {
    const { errors: cnpjErrors } = await transformAndValidate({ issuerCnpj: '123456780001ab' });
    expect(cnpjErrors.some(error => error.property === 'issuerCnpj')).toBe(true);

    const { errors: ufErrors } = await transformAndValidate({ sourceUf: 'CE' });
    expect(ufErrors.some(error => error.property === 'sourceUf')).toBe(true);

    const { errors: dateErrors } = await transformAndValidate({ issuedFrom: '2026-02-30' });
    expect(dateErrors.some(error => error.property === 'issuedFrom')).toBe(true);
  });

  it('rejects invalid sort, limit > 100, negative amounts, and search > 120 chars', async () => {
    const { errors } = await transformAndValidate({
      sort: 'unknown:desc' as FiscalNoteListSort,
      limit: '101',
      page: '0',
      minAmountCents: '-1',
      search: 'a'.repeat(121),
    });

    const invalidProperties = errors.map(error => error.property);
    expect(invalidProperties).toEqual(expect.arrayContaining(['sort', 'limit', 'page', 'minAmountCents', 'search']));
  });
});
