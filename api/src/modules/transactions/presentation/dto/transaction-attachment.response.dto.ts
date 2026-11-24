import { RESPONSE_OBJECT_TYPES } from '@/common/models/constants';
import { ApiProperty } from '@nestjs/swagger';

export interface TransactionAttachmentResponseSource {
  id: string;
  assetId: string;
  position: number;
  contentType: string;
  sizeBytes: number;
  url: string;
  expiresAt: Date;
  cacheMaxAgeSeconds: number;
}

export class TransactionAttachmentResponseDto {
  @ApiProperty({ example: RESPONSE_OBJECT_TYPES.TRANSACTION_ATTACHMENT_ITEM })
  readonly object: typeof RESPONSE_OBJECT_TYPES.TRANSACTION_ATTACHMENT_ITEM;

  @ApiProperty({ format: 'uuid', example: '9e587d6d-dd96-4c74-ab06-6e6f11d4027d' })
  readonly id: string;

  @ApiProperty({ format: 'uuid', example: '85423f76-b2e0-4499-8b94-da58b1df6f74' })
  readonly assetId: string;

  @ApiProperty({ minimum: 0, maximum: 2, example: 0, description: 'Posição do comprovante na galeria (0 a 2)' })
  readonly position: number;

  @ApiProperty({ example: 'image/webp' })
  readonly contentType: string;

  @ApiProperty({ example: 245100, description: 'Tamanho do arquivo em bytes' })
  readonly sizeBytes: number;

  @ApiProperty({ example: 'https://r2.cloudflarestorage.com/bucket/key?token=...' })
  readonly url: string;

  @ApiProperty({ format: 'date-time' })
  readonly expiresAt: Date;

  @ApiProperty({ example: 240, description: 'Janela de cache recomendada em segundos para o cliente' })
  readonly cacheMaxAgeSeconds: number;

  static fromOutput(item: TransactionAttachmentResponseSource): TransactionAttachmentResponseDto {
    return {
      object: RESPONSE_OBJECT_TYPES.TRANSACTION_ATTACHMENT_ITEM,
      id: item.id,
      assetId: item.assetId,
      position: item.position,
      contentType: item.contentType,
      sizeBytes: item.sizeBytes,
      url: item.url,
      expiresAt: item.expiresAt,
      cacheMaxAgeSeconds: item.cacheMaxAgeSeconds,
    };
  }

  static fromOutputList(items: TransactionAttachmentResponseSource[]): TransactionAttachmentResponseDto[] {
    return items.map(item => TransactionAttachmentResponseDto.fromOutput(item));
  }
}
