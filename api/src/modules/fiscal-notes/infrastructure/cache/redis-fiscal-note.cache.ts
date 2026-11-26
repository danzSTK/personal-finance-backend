import { CacheKeys } from '@/common/utils/cache-keys.factory';
import { isValidDateOnly } from '@/common/utils/date-only';
import fiscalNotesConfig, { type FiscalNotesConfig } from '@/config/fiscal-notes.config';
import { IFiscalNoteCache } from '@/modules/fiscal-notes/application/ports/fiscal-note-cache.port';
import { ParsedFiscalNoteData } from '@/modules/fiscal-notes/application/ports/fiscal-note-provider.port';
import {
  FiscalNoteLogEvents,
  maskAccessKeyForLog,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { RedisService } from '@/database/redis/redis.service';
import { Inject, Injectable, Logger } from '@nestjs/common';

interface CachedFiscalNotePayload extends Omit<ParsedFiscalNoteData, 'issuedAt'> {
  issuedAt: string;
}

@Injectable()
export class RedisFiscalNoteCache extends IFiscalNoteCache {
  private readonly logger = new Logger(RedisFiscalNoteCache.name);

  constructor(
    private readonly redisService: RedisService,
    @Inject(fiscalNotesConfig.KEY)
    private readonly config: FiscalNotesConfig,
  ) {
    super();
  }

  async get(accessKey: string): Promise<ParsedFiscalNoteData | null> {
    const cacheKey = CacheKeys.fiscalNotes.parsed(accessKey);

    try {
      const raw = await this.redisService.getClient().get(cacheKey);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as CachedFiscalNotePayload;
      if (!parsed || typeof parsed !== 'object' || typeof parsed.issuedAt !== 'string') {
        return null;
      }

      const issuedAt = new Date(parsed.issuedAt);
      if (Number.isNaN(issuedAt.getTime()) || !isValidDateOnly(parsed.issuedDate)) {
        return null;
      }

      return {
        ...parsed,
        issuedAt,
        issuedDate: parsed.issuedDate,
      };
    } catch (error: unknown) {
      this.logger.warn({
        event: FiscalNoteLogEvents.FISCAL_NOTE_CACHE_REDIS_ERROR,
        accessKeyMasked: maskAccessKeyForLog(accessKey),
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async set(accessKey: string, data: ParsedFiscalNoteData): Promise<void> {
    const cacheKey = CacheKeys.fiscalNotes.parsed(accessKey);
    const payload: CachedFiscalNotePayload = {
      ...data,
      issuedAt: data.issuedAt.toISOString(),
    };

    try {
      await this.redisService.getClient().set(cacheKey, JSON.stringify(payload), 'EX', this.config.cache.ttlSeconds);
    } catch (error: unknown) {
      this.logger.warn({
        event: FiscalNoteLogEvents.FISCAL_NOTE_CACHE_REDIS_ERROR,
        accessKeyMasked: maskAccessKeyForLog(accessKey),
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
