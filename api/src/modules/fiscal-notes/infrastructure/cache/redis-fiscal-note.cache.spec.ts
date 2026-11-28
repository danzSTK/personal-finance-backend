import { CacheKeys } from '@/common/utils/cache-keys.factory';
import { toDateOnly } from '@/common/utils/date-only';
import { type FiscalNotesConfig } from '@/config/fiscal-notes.config';
import { RedisService } from '@/database/redis/redis.service';
import { ParsedFiscalNoteData } from '@/modules/fiscal-notes/application/ports';
import {
  FiscalNoteLogEvents,
  SEFAZ_CE_PARSER_VERSION,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { RedisFiscalNoteCache } from '@/modules/fiscal-notes/infrastructure/cache/redis-fiscal-note.cache';
import { Logger } from '@nestjs/common';

const VALID_CE_KEY = '23261003539462000250651030000760541443208780';

function buildParsedData(): ParsedFiscalNoteData {
  return {
    accessKey: VALID_CE_KEY,
    sourceUf: '23',
    number: '76054',
    series: '103',
    issuedAt: new Date('2026-10-16T01:15:30.000Z'),
    issuedDate: toDateOnly('2026-10-15'),
    protocol: '223260123456789',
    issuerName: 'SUPERMERCADO EXEMPLO',
    issuerCnpj: '03539462000250',
    issuerAddress: 'Fortaleza, CE',
    grossAmountCents: 4013,
    discountAmountCents: 872,
    payableAmountCents: 3141,
    taxAmountCents: 1051,
    changeAmountCents: null,
    xmlVersion: '4.00',
    xsltVersion: '2.05',
    parserVersion: SEFAZ_CE_PARSER_VERSION,
    items: [
      {
        position: 1,
        rawDescription: 'CAFE',
        storeCode: '10',
        unit: 'UN',
        quantity: 1,
        unitPrice: 31.41,
        totalPriceCents: 3141,
      },
    ],
    payments: [{ position: 1, methodLabel: 'PIX', amountCents: 3141 }],
  };
}

describe('RedisFiscalNoteCache', () => {
  let redisClient: { get: jest.Mock; set: jest.Mock };
  let redisService: jest.Mocked<Pick<RedisService, 'getClient'>>;
  let cache: RedisFiscalNoteCache;
  let warnSpy: jest.SpyInstance;

  const config = {
    cache: { ttlSeconds: 1200 },
  } as unknown as FiscalNotesConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    redisClient = {
      get: jest.fn(),
      set: jest.fn(),
    };
    redisService = {
      getClient: jest.fn().mockReturnValue(redisClient),
    };
    cache = new RedisFiscalNoteCache(redisService as unknown as RedisService, config);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('set & get', () => {
    it('stores parsed data as JSON with configured TTL and restores issuedAt as Date', async () => {
      const sample = buildParsedData();
      let storedJson = '';
      redisClient.set.mockImplementation((_key: string, value: string) => {
        storedJson = value;
        return Promise.resolve('OK');
      });
      redisClient.get.mockImplementation(() => Promise.resolve(storedJson));

      await cache.set(VALID_CE_KEY, sample);
      const loaded = await cache.get(VALID_CE_KEY);

      expect(redisClient.set).toHaveBeenCalledWith(
        CacheKeys.fiscalNotes.parsed(VALID_CE_KEY),
        expect.any(String),
        'EX',
        1200,
      );
      expect(loaded).not.toBeNull();
      expect(loaded?.issuedAt).toBeInstanceOf(Date);
      expect(loaded?.issuedAt.toISOString()).toBe('2026-10-16T01:15:30.000Z');
      expect(loaded?.issuedDate).toBe('2026-10-15');
    });

    it('returns null on cache miss or corrupted JSON', async () => {
      redisClient.get.mockResolvedValueOnce(null).mockResolvedValueOnce('{invalid');

      await expect(cache.get(VALID_CE_KEY)).resolves.toBeNull();
      await expect(cache.get(VALID_CE_KEY)).resolves.toBeNull();
    });

    it('degrades safely on Redis errors without throwing', async () => {
      redisClient.get.mockRejectedValue(new Error('Redis down'));
      redisClient.set.mockRejectedValue(new Error('Redis down'));

      await expect(cache.get(VALID_CE_KEY)).resolves.toBeNull();
      await expect(cache.set(VALID_CE_KEY, buildParsedData())).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: FiscalNoteLogEvents.FISCAL_NOTE_CACHE_REDIS_ERROR,
          accessKeyMasked: '23***8780',
        }),
      );
    });
  });
});
