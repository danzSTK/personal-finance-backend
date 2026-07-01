import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ConfirmEmailVerificationDto {
  @ApiProperty({
    description: 'Token completo recebido pelo frontend no link de verificação.',
    example: 'mJ7S5edqV09JQ2xlWTtqWd-bFfvDEIuGlwGgHEiqeuc',
  })
  @IsString()
  @MinLength(20)
  @MaxLength(512)
  token!: string;
}
