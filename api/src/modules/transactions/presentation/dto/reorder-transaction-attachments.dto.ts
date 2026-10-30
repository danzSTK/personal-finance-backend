import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator';

export class AttachmentPositionItemDto {
  @ApiProperty({ format: 'uuid', description: 'ID do anexo' })
  @IsUUID('4')
  id: string;

  @ApiProperty({ minimum: 0, maximum: 2, description: 'Nova posição do anexo (0 a 2)' })
  @IsInt()
  @Min(0)
  @Max(2)
  position: number;
}

export class ReorderTransactionAttachmentsDto {
  @ApiProperty({
    type: [AttachmentPositionItemDto],
    description: 'Lista completa de anexos da transação com as novas posições',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AttachmentPositionItemDto)
  positions: AttachmentPositionItemDto[];
}
