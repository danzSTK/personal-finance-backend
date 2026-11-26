import { FISCAL_NOTE_INPUT_MAX_LENGTH } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LinkFiscalNoteDto {
  @ApiProperty({
    example: 'http://nfce.sefaz.ce.gov.br/nfce/pagina?p=23261003539462000250651030000760541443208780|2|1|1|HASH',
    maxLength: FISCAL_NOTE_INPUT_MAX_LENGTH,
    description: 'URL/payload do QR Code da NFC-e ou chave de acesso de 44 dígitos',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(FISCAL_NOTE_INPUT_MAX_LENGTH)
  input: string;
}
