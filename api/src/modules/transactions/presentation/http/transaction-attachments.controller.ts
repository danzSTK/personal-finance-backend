import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PlatformErrorResponseDto } from '@/common/dto/platform-error.response.dto';
import { AddTransactionAttachmentsUseCase } from '@/modules/transactions/application/use-cases/add-transaction-attachments/add-transaction-attachments.use-case';
import { DeleteTransactionAttachmentUseCase } from '@/modules/transactions/application/use-cases/delete-transaction-attachment/delete-transaction-attachment.use-case';
import { ListTransactionAttachmentsUseCase } from '@/modules/transactions/application/use-cases/list-transaction-attachments/list-transaction-attachments.use-case';
import { ReorderTransactionAttachmentsUseCase } from '@/modules/transactions/application/use-cases/reorder-transaction-attachments/reorder-transaction-attachments.use-case';
import { ReorderTransactionAttachmentsDto } from '@/modules/transactions/presentation/dto/reorder-transaction-attachments.dto';
import { TransactionAttachmentResponseDto } from '@/modules/transactions/presentation/dto/transaction-attachment.response.dto';
import { User } from '@/modules/users/domain/entities/user.entity';
import { JwtAuthGuard } from '@/shared/guards/jwt-auth.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('transactions')
@ApiCookieAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('transactions/:id/attachments')
export class TransactionAttachmentsController {
  constructor(
    private readonly addTransactionAttachmentsUseCase: AddTransactionAttachmentsUseCase,
    private readonly listTransactionAttachmentsUseCase: ListTransactionAttachmentsUseCase,
    private readonly deleteTransactionAttachmentUseCase: DeleteTransactionAttachmentUseCase,
    private readonly reorderTransactionAttachmentsUseCase: ReorderTransactionAttachmentsUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar anexos da transação com Presigned URLs' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID da transação' })
  @ApiOkResponse({ type: [TransactionAttachmentResponseDto] })
  @ApiResponse({ status: 401, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 404, type: PlatformErrorResponseDto })
  async listAttachments(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) transactionId: string,
  ): Promise<TransactionAttachmentResponseDto[]> {
    return this.listTransactionAttachmentsUseCase.execute({
      userId: user.id,
      transactionId,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Adicionar até 3 comprovantes à transação' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID da transação' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Arquivos de imagem (PNG, JPEG, WebP, máx 5 MB cada, até 60 MP)',
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: [TransactionAttachmentResponseDto] })
  @ApiResponse({ status: 400, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 401, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 404, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 409, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 413, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 415, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 422, type: PlatformErrorResponseDto })
  @UseInterceptors(
    FilesInterceptor('files', 3, {
      limits: {
        files: 3,
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async addAttachments(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) transactionId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<TransactionAttachmentResponseDto[]> {
    const inputFiles = (files ?? []).map(file => ({
      buffer: file.buffer,
      originalname: file.originalname,
    }));

    return this.addTransactionAttachmentsUseCase.execute({
      userId: user.id,
      transactionId,
      files: inputFiles,
    });
  }

  @Delete(':attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover um anexo individual da transação' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID da transação' })
  @ApiParam({ name: 'attachmentId', format: 'uuid', description: 'ID do anexo' })
  @ApiNoContentResponse({ description: 'Anexo removido da transação com sucesso' })
  @ApiResponse({ status: 401, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 404, type: PlatformErrorResponseDto })
  async deleteAttachment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) transactionId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ): Promise<void> {
    await this.deleteTransactionAttachmentUseCase.execute({
      userId: user.id,
      transactionId,
      attachmentId,
    });
  }

  @Patch('positions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reordenar comprovantes na galeria da transação' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID da transação' })
  @ApiNoContentResponse({ description: 'Posições atualizadas com sucesso' })
  @ApiResponse({ status: 400, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 401, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 404, type: PlatformErrorResponseDto })
  async reorderPositions(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) transactionId: string,
    @Body() body: ReorderTransactionAttachmentsDto,
  ): Promise<void> {
    await this.reorderTransactionAttachmentsUseCase.execute({
      userId: user.id,
      transactionId,
      positions: body.positions,
    });
  }
}
