import objectStorageConfig from '@/config/object-storage.config';
import {
  INSTITUTIONAL_ACCOUNT_TEMPLATES,
  InstitutionalAccountTemplateCatalogEntry,
} from '@/modules/accounts/infrastructure/catalog/institutional-account-templates.catalog';
import { IObjectStorage } from '@/shared/object-storage';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { createHash } from 'node:crypto';

const BRASIL_API_BANKS_V1_URL = 'https://brasilapi.com.br/api/banks/v1';
const ALLOWED_LOGO_HOST = 'cdn.jsdelivr.net';
const ALLOWED_LOGO_PATH_PREFIX = '/npm/logos-bancos-br@0/logos/svg/';
const MAX_SVG_BYTES = 256 * 1024;

interface BrasilApiBank {
  code: number;
  ispb: string;
  name: string;
  fullName: string;
  logo_url: string;
}

@Injectable()
export class CurateInstitutionalAccountTemplatesUseCase {
  constructor(
    @Inject(objectStorageConfig.KEY)
    private readonly storageConfig: ConfigType<typeof objectStorageConfig>,
    private readonly objectStorage: IObjectStorage,
  ) {}

  async execute(): Promise<number> {
    const banks = await this.fetchBrasilApiBanks();

    for (const entry of INSTITUTIONAL_ACCOUNT_TEMPLATES) {
      this.assertBrasilApiRecord(entry, banks);
      const bytes = await this.downloadAndValidateSvg(entry);
      await this.publish(entry, bytes);
    }

    return INSTITUTIONAL_ACCOUNT_TEMPLATES.length;
  }

  private async fetchBrasilApiBanks(): Promise<BrasilApiBank[]> {
    const response = await fetch(BRASIL_API_BANKS_V1_URL, { redirect: 'error' });

    if (!response.ok) {
      throw new Error(`BrasilAPI returned HTTP ${response.status}.`);
    }

    const payload: unknown = await response.json();

    if (!Array.isArray(payload)) {
      throw new Error('BrasilAPI returned an unexpected banks payload.');
    }

    return payload.filter(isBrasilApiBank);
  }

  private assertBrasilApiRecord(
    entry: InstitutionalAccountTemplateCatalogEntry,
    banks: readonly BrasilApiBank[],
  ): void {
    const bank = banks.find(candidate => candidate.code === entry.bankCode);

    if (
      !bank ||
      bank.ispb !== entry.ispb ||
      bank.name !== entry.brasilApiName ||
      bank.fullName !== entry.brasilApiFullName ||
      bank.logo_url !== entry.sourceLogoUrl
    ) {
      throw new Error(`BrasilAPI data diverged for catalog entry ${entry.catalogKey}.`);
    }
  }

  private async downloadAndValidateSvg(entry: InstitutionalAccountTemplateCatalogEntry): Promise<Uint8Array> {
    this.assertAllowedLogoUrl(entry);
    const response = await fetch(entry.sourceLogoUrl, { redirect: 'manual' });

    if (response.status !== 200) {
      throw new Error(`Logo download returned HTTP ${response.status} for ${entry.catalogKey}.`);
    }

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    if (contentType !== 'image/svg+xml') {
      throw new Error(`Unexpected logo content type for ${entry.catalogKey}: ${contentType ?? 'missing'}.`);
    }

    const contentLengthHeader = response.headers.get('content-length');
    if (contentLengthHeader && Number(contentLengthHeader) > MAX_SVG_BYTES) {
      throw new Error(`SVG exceeds the size limit for ${entry.catalogKey}.`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_SVG_BYTES) {
      throw new Error(`SVG has an invalid size for ${entry.catalogKey}.`);
    }

    this.assertSafeSvg(bytes, entry.catalogKey);
    const checksum = createHash('sha256').update(bytes).digest('hex');

    if (checksum !== entry.sourceChecksumSha256) {
      throw new Error(`SVG checksum diverged for ${entry.catalogKey}.`);
    }

    return bytes;
  }

  private assertAllowedLogoUrl(entry: InstitutionalAccountTemplateCatalogEntry): void {
    const url = new URL(entry.sourceLogoUrl);
    const expectedPath = `${ALLOWED_LOGO_PATH_PREFIX}${entry.ispb}.svg`;

    if (url.protocol !== 'https:' || url.hostname !== ALLOWED_LOGO_HOST || url.pathname !== expectedPath) {
      throw new Error(`Logo URL is outside the allowlist for ${entry.catalogKey}.`);
    }

    if (url.username || url.password || url.port || url.search || url.hash) {
      throw new Error(`Logo URL contains unsupported components for ${entry.catalogKey}.`);
    }
  }

  private assertSafeSvg(bytes: Uint8Array, catalogKey: string): void {
    let svg: string;

    try {
      svg = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new Error(`SVG is not valid UTF-8 for ${catalogKey}.`);
    }

    if (!/^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(svg)) {
      throw new Error(`Downloaded bytes are not an SVG for ${catalogKey}.`);
    }

    const forbiddenMarkup = [
      /<!doctype/i,
      /<!entity/i,
      /<script[\s>]/i,
      /<foreignObject[\s>]/i,
      /\son[a-z]+\s*=/i,
      /(?:href|src)\s*=\s*["']\s*(?:https?:|\/\/|data:|javascript:)/i,
    ];

    if (forbiddenMarkup.some(pattern => pattern.test(svg))) {
      throw new Error(`SVG contains forbidden active markup for ${catalogKey}.`);
    }
  }

  private async publish(entry: InstitutionalAccountTemplateCatalogEntry, bytes: Uint8Array): Promise<void> {
    const location = {
      bucket: this.storageConfig.publicBucketName,
      key: entry.storageKey,
    };
    const existing = await this.objectStorage.headObject(location);
    const existingChecksum = existing?.metadata.sha256;

    if (existing && existingChecksum !== entry.sourceChecksumSha256) {
      throw new Error(`Refusing to overwrite unreviewed object ${entry.storageKey}.`);
    }

    if (
      existing &&
      existingChecksum === entry.sourceChecksumSha256 &&
      existing.contentLength === bytes.byteLength &&
      existing.contentType === 'image/svg+xml'
    ) {
      return;
    }

    await this.objectStorage.putObject({
      ...location,
      body: bytes,
      contentType: 'image/svg+xml',
      checksumSha256Hex: entry.sourceChecksumSha256,
      metadata: {
        sha256: entry.sourceChecksumSha256,
        catalogKey: entry.catalogKey,
        source: 'brasilapi-v1',
      },
    });

    const published = await this.objectStorage.headObject(location);
    if (
      !published ||
      published.contentLength !== bytes.byteLength ||
      published.contentType !== 'image/svg+xml' ||
      published.metadata.sha256 !== entry.sourceChecksumSha256
    ) {
      throw new Error(`Published object verification failed for ${entry.catalogKey}.`);
    }
  }
}

function isBrasilApiBank(value: unknown): value is BrasilApiBank {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const bank = value as Record<string, unknown>;
  return (
    typeof bank.code === 'number' &&
    typeof bank.ispb === 'string' &&
    typeof bank.name === 'string' &&
    typeof bank.fullName === 'string' &&
    typeof bank.logo_url === 'string'
  );
}
