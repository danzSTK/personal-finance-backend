---
area: users
type: implementation-guide
status: current
related:
  - ../flows/update-user-avatar.md
  - ../../assets/README.md
  - ../../events/user-avatar-updated.md
  - ../../storage/README.md
---

# Implementar Update User Avatar

Este guia registra o raciocínio usado para implementar o primeiro fluxo de avatar sobre a base atual. A implementação funcional já faz parte da aplicação; consulte os arquivos fonte quando houver diferença entre um trecho didático e o código atual.

Nota de implementação: `file-type@22` é ESM-only. O código final separa `IImageFileTypeDetector` e `FileTypeImageDetector`, que carrega `file-type` com import dinâmico. `SharpAvatarImageProcessor` depende dessa porta, o que mantém os testes compatíveis com o Jest atual.

## Escopo

O fluxo implementa:

- `PUT /users/me/avatar` com `multipart/form-data`;
- limite de entrada de 5 MB em memória;
- detecção do formato pelos bytes com `file-type`;
- normalização para WebP com Sharp;
- registro `Asset` em `PENDING_UPLOAD`;
- upload no bucket público do R2;
- transação curta para marcar o asset `READY`, trocar `User.avatarAssetId` e gravar `UserAvatarUpdatedEvent` na outbox;
- resposta com `assetId` e URL pública.

Não pertence a esta etapa:

- handler que remove o avatar anterior;
- job de reconciliação;
- projeção da URL do avatar em `GET /users/me`;
- endpoint para remover avatar sem substituição.

## Decisão De Ownership

O use case fica em `modules/users/application/use-cases/update-user-avatar/`.

`users` é o dono da referência `avatarAssetId` e da decisão de substituí-la. `assets` controla identidade e estado do objeto. `object-storage` abstrai R2/S3. O use case de `users` coordena essas três capacidades sem levar SDK S3 ou Sharp para o domínio.

## Ordem Do Fluxo

```text
HTTP multipart
  -> valida tamanho
  -> detecta bytes e gera WebP
  -> cria Asset(PENDING_UPLOAD)
  -> persiste Asset
  -> envia bytes ao R2
  -> transação PostgreSQL
       -> lock pessimista em User
       -> recarrega Asset PENDING_UPLOAD
       -> Asset.markReady()
       -> User.changeAvatarAsset()
       -> salva Asset e User
       -> grava eventos na outbox
  -> invalida cache do User depois do commit
  -> retorna assetId + publicUrl
```

O usuário nunca deve apontar para um asset `PENDING_UPLOAD`. A referência só muda na mesma transação que torna o asset `READY`.

O upload não deve acontecer enquanto o lock do usuário estiver aberto. R2 é uma operação externa e lenta; manter uma transação PostgreSQL esperando rede aumenta contenção e tempo de lock.

## Estrutura De Arquivos

```text
api/src/common/models/constants/
└── user-avatar.constants.ts

api/src/modules/users/
├── application/
│   ├── errors/
│   │   ├── avatar-file-too-large.error.ts
│   │   ├── avatar-upload-failed.error.ts
│   │   ├── invalid-avatar-image.error.ts
│   │   └── unsupported-avatar-file.error.ts
│   ├── ports/
│   │   ├── avatar-image-processor.interface.ts
│   │   └── user-cache-invalidator.interface.ts
│   └── use-cases/update-user-avatar/
│       ├── update-user-avatar.dto.ts
│       ├── update-user-avatar.use-case.spec.ts
│       └── update-user-avatar.use-case.ts
├── infrastructure/
│   ├── cache/redis-user-cache-invalidator.ts
│   └── image-processing/sharp-avatar-image.processor.ts
└── presentation/
    └── dto/update-user-avatar.response.dto.ts
```

Arquivos alterados:

```text
api/src/common/filters/app-exception.filter.ts
api/src/common/models/constants/index.ts
api/src/modules/users/infrastructure/persistence/cached-user.repository.ts
api/src/modules/users/presentation/http/users.controller.ts
api/src/modules/users/users.module.ts
docs/integrations/users/...
```

## 1. Constantes

Arquivo: `api/src/common/models/constants/user-avatar.constants.ts`

```ts
export const USER_AVATAR_MAX_INPUT_BYTES = 5 * 1024 * 1024;
export const USER_AVATAR_MAX_INPUT_PIXELS = 40_000_000;
export const USER_AVATAR_WIDTH = 512;
export const USER_AVATAR_HEIGHT = 512;
export const USER_AVATAR_WEBP_QUALITY = 82;

export const USER_AVATAR_ALLOWED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type UserAvatarAllowedMediaType =
  (typeof USER_AVATAR_ALLOWED_MEDIA_TYPES)[number];
```

Exporte em `api/src/common/models/constants/index.ts`:

```ts
export * from "./user-avatar.constants";
```

O limite do Multer e o limite do processor devem vir da mesma constante. O segundo limite protege chamadas diretas ao use case e testes, não apenas HTTP.

## 2. Porta De Processamento

Arquivo: `api/src/modules/users/application/ports/avatar-image-processor.interface.ts`

```ts
export interface ProcessedAvatarImage {
  bytes: Uint8Array;
  contentType: "image/webp";
  sizeBytes: number;
  checksum: string;
  metadata: {
    width: number;
    height: number;
    format: "webp";
  };
}

export abstract class IAvatarImageProcessor {
  abstract process(input: Uint8Array): Promise<ProcessedAvatarImage>;
}
```

O use case conhece essa porta, não conhece Sharp nem `file-type`.

## 3. Erros De Aplicação

Arquivo: `api/src/modules/users/application/errors/avatar-file-too-large.error.ts`

```ts
import { ApplicationError } from "@/shared/application";

export class AvatarFileTooLargeError extends ApplicationError {
  readonly code = "AVATAR_FILE_TOO_LARGE";

  constructor() {
    super("Avatar image exceeds the maximum allowed size.");
  }
}
```

Arquivo: `api/src/modules/users/application/errors/unsupported-avatar-file.error.ts`

```ts
import { ApplicationError } from "@/shared/application";

export class UnsupportedAvatarFileError extends ApplicationError {
  readonly code = "UNSUPPORTED_AVATAR_FILE";

  constructor() {
    super("Avatar image format is not supported.");
  }
}
```

Arquivo: `api/src/modules/users/application/errors/invalid-avatar-image.error.ts`

```ts
import { ApplicationError } from "@/shared/application";

export class InvalidAvatarImageError extends ApplicationError {
  readonly code = "INVALID_AVATAR_IMAGE";

  constructor() {
    super("Avatar image could not be decoded.");
  }
}
```

Arquivo: `api/src/modules/users/application/errors/avatar-upload-failed.error.ts`

```ts
import { ApplicationError } from "@/shared/application";

export class AvatarUploadFailedError extends ApplicationError {
  readonly code = "AVATAR_UPLOAD_FAILED";

  constructor() {
    super("Avatar image could not be stored.");
  }
}
```

Exporte os quatro erros em `api/src/modules/users/application/errors/index.ts`.

Adicione ao mapa de `api/src/common/filters/app-exception.filter.ts`:

```ts
AVATAR_FILE_TOO_LARGE: HttpStatus.PAYLOAD_TOO_LARGE,
AVATAR_UPLOAD_FAILED: HttpStatus.SERVICE_UNAVAILABLE,
INVALID_AVATAR_IMAGE: HttpStatus.UNPROCESSABLE_ENTITY,
UNSUPPORTED_AVATAR_FILE: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
```

Os códigos são o contrato estável do frontend. Não exponha `requestId`, mensagem do R2, stack ou erro interno do Sharp.

## 4. Adapter Sharp

Arquivo: `api/src/modules/users/infrastructure/image-processing/sharp-avatar-image.processor.ts`

```ts
import {
  USER_AVATAR_ALLOWED_MEDIA_TYPES,
  USER_AVATAR_HEIGHT,
  USER_AVATAR_MAX_INPUT_BYTES,
  USER_AVATAR_MAX_INPUT_PIXELS,
  USER_AVATAR_WEBP_QUALITY,
  USER_AVATAR_WIDTH,
} from "@/common/models/constants";
import {
  AvatarFileTooLargeError,
  InvalidAvatarImageError,
  UnsupportedAvatarFileError,
} from "@/modules/users/application/errors";
import {
  IAvatarImageProcessor,
  ProcessedAvatarImage,
} from "@/modules/users/application/ports/avatar-image-processor.interface";
import { Injectable } from "@nestjs/common";
import { fileTypeFromBuffer } from "file-type";
import { createHash } from "node:crypto";
import sharp from "sharp";

@Injectable()
export class SharpAvatarImageProcessor implements IAvatarImageProcessor {
  async process(input: Uint8Array): Promise<ProcessedAvatarImage> {
    if (input.byteLength > USER_AVATAR_MAX_INPUT_BYTES) {
      throw new AvatarFileTooLargeError();
    }

    let detectedType;

    try {
      detectedType = await fileTypeFromBuffer(input);
    } catch {
      throw new InvalidAvatarImageError();
    }

    if (
      !detectedType ||
      !USER_AVATAR_ALLOWED_MEDIA_TYPES.includes(
        detectedType.mime as (typeof USER_AVATAR_ALLOWED_MEDIA_TYPES)[number],
      )
    ) {
      throw new UnsupportedAvatarFileError();
    }

    try {
      const { data, info } = await sharp(input, {
        animated: false,
        failOn: "error",
        limitInputPixels: USER_AVATAR_MAX_INPUT_PIXELS,
      })
        .rotate()
        .resize(USER_AVATAR_WIDTH, USER_AVATAR_HEIGHT, {
          fit: "cover",
          position: "attention",
        })
        .webp({ quality: USER_AVATAR_WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });

      return {
        bytes: data,
        contentType: "image/webp",
        sizeBytes: data.byteLength,
        checksum: createHash("sha256").update(data).digest("hex"),
        metadata: {
          width: info.width,
          height: info.height,
          format: "webp",
        },
      };
    } catch {
      throw new InvalidAvatarImageError();
    }
  }
}
```

Não use `file.mimetype` como prova do formato. Esse valor vem do cliente. `file-type` reconhece a assinatura dos bytes e Sharp confirma que o conteúdo é decodificável.

Sharp remove metadata quando não chamamos `.withMetadata()`. O `.rotate()` aplica orientação EXIF antes de descartá-la.

## 5. DTO De Aplicação

Arquivo: `api/src/modules/users/application/use-cases/update-user-avatar/update-user-avatar.dto.ts`

```ts
export interface UpdateUserAvatarInput {
  userId: string;
  bytes: Uint8Array;
}

export interface UpdateUserAvatarOutput {
  assetId: string;
  url: string;
}
```

O input recebe somente `userId` derivado do JWT e os bytes capturados pelo controller. Nunca aceite `userId`, bucket ou storage key do body.

## 6. Invalidação Pós-Commit

O `CachedUserRepository.save(user, { manager })` atual escreve no Redis antes do commit. Esse comportamento pode publicar estado ainda não confirmado e deixar cache incorreto se a transação falhar.

Antes do use case, separe a invalidação de cache em uma porta pós-commit.

Arquivo: `api/src/modules/users/application/ports/user-cache-invalidator.interface.ts`

```ts
import { User } from "@/modules/users/domain/entities/user.entity";

export abstract class IUserCacheInvalidator {
  abstract invalidate(user: User): Promise<void>;
}
```

Arquivo: `api/src/modules/users/infrastructure/cache/redis-user-cache-invalidator.ts`

```ts
import { CacheKeys } from "@/common/utils/cache-keys.factory";
import { RedisService } from "@/database/redis/redis.service";
import { IUserCacheInvalidator } from "@/modules/users/application/ports/user-cache-invalidator.interface";
import { User } from "@/modules/users/domain/entities/user.entity";
import { Injectable } from "@nestjs/common";

@Injectable()
export class RedisUserCacheInvalidator implements IUserCacheInvalidator {
  constructor(private readonly cache: RedisService) {}

  async invalidate(user: User): Promise<void> {
    await Promise.all([
      this.cache.del(CacheKeys.users.byId(user.id)),
      this.cache.del(CacheKeys.users.byEmailIndex(user.email.value)),
      user.userName
        ? this.cache.del(CacheKeys.users.byUserNameIndex(user.userName.value))
        : Promise.resolve(),
      user.userName
        ? this.cache.del(
            CacheKeys.users.usernameAlreadyExists(user.userName.value),
          )
        : Promise.resolve(),
    ]);
  }
}
```

No `CachedUserRepository`, injete `IUserCacheInvalidator`, reutilize-o nos writes normais e não escreva cache quando há `manager`:

```ts
async save(user: User, options?: IRepositoryOptions): Promise<User> {
  if (options?.manager) {
    return this.userRepository.save(user, options);
  }

  const saved = await this.userRepository.save(user);
  await this.cacheInvalidator.invalidate(saved);

  const refreshed = await this.userRepository.findById(saved.id);

  if (!refreshed) {
    throw new Error('User not found after save');
  }

  await this.cache.set(
    CacheKeys.users.byId(refreshed.id),
    this.serializeUser(refreshed),
    this.cacheTtl,
  );

  return refreshed;
}
```

O use case de avatar chama `IUserCacheInvalidator.invalidate()` somente depois que `DataSource.transaction()` resolve. Faça uma busca nos outros use cases que chamam `save(..., { manager })` antes de aplicar essa mudança global: eles também devem invalidar depois do próprio commit quando alterarem um usuário já cacheado.

## 7. Use Case

Arquivo: `api/src/modules/users/application/use-cases/update-user-avatar/update-user-avatar.use-case.ts`

```ts
import objectStorageConfig from "@/config/object-storage.config";
import { AssetPurpose } from "@/modules/assets/domain/enums";
import { AssetFactory } from "@/modules/assets/domain/factories";
import { IAssetRepository } from "@/modules/assets/domain/repositories";
import {
  AvatarUploadFailedError,
  UserNotFoundError,
} from "@/modules/users/application/errors";
import { IAvatarImageProcessor } from "@/modules/users/application/ports/avatar-image-processor.interface";
import { IUserCacheInvalidator } from "@/modules/users/application/ports/user-cache-invalidator.interface";
import {
  UpdateUserAvatarInput,
  UpdateUserAvatarOutput,
} from "@/modules/users/application/use-cases/update-user-avatar/update-user-avatar.dto";
import { User } from "@/modules/users/domain/entities/user.entity";
import { IUserRepository } from "@/modules/users/domain/repositories/user.respository.interface";
import { IObjectStorage, ObjectStorageError } from "@/shared/object-storage";
import { OutboxWriteService } from "@/shared/outbox/services/outbox-write.service";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

@Injectable()
export class UpdateUserAvatarUseCase {
  private readonly logger = new Logger(UpdateUserAvatarUseCase.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(objectStorageConfig.KEY)
    private readonly storageConfig: ConfigType<typeof objectStorageConfig>,
    private readonly userRepository: IUserRepository,
    private readonly assetRepository: IAssetRepository,
    private readonly imageProcessor: IAvatarImageProcessor,
    private readonly objectStorage: IObjectStorage,
    private readonly outboxWriter: OutboxWriteService,
    private readonly userCacheInvalidator: IUserCacheInvalidator,
  ) {}

  async execute(input: UpdateUserAvatarInput): Promise<UpdateUserAvatarOutput> {
    const processed = await this.imageProcessor.process(input.bytes);
    const asset = AssetFactory.createPendingUpload({
      userId: input.userId,
      purpose: AssetPurpose.USER_AVATAR,
      bucket: this.storageConfig.publicBucketName,
    });

    await this.assetRepository.save(asset);

    try {
      await this.objectStorage.putObject({
        bucket: asset.bucket,
        key: asset.storageKey,
        body: processed.bytes,
        contentType: processed.contentType,
        checksumSha256Hex: processed.checksum,
        metadata: {
          assetId: asset.id,
          userId: input.userId,
          purpose: asset.purpose,
        },
      });
    } catch (error) {
      await this.recordUploadFailure(asset.id, input.userId, error);
      throw new AvatarUploadFailedError();
    }

    let updatedUser: User;

    try {
      updatedUser = await this.dataSource.transaction(async (manager) => {
        const user = await this.userRepository.findByIdForUpdate(input.userId, {
          manager,
        });

        if (!user) {
          throw new UserNotFoundError();
        }

        const pendingAsset = await this.assetRepository.findByIdAndUserId(
          asset.id,
          input.userId,
          {
            manager,
          },
        );

        if (!pendingAsset) {
          throw new Error("Pending avatar asset was not found.");
        }

        pendingAsset.markReady({
          contentType: processed.contentType,
          sizeBytes: processed.sizeBytes,
          checksum: processed.checksum,
          metadata: processed.metadata,
        });

        user.changeAvatarAsset(pendingAsset.id);

        await this.assetRepository.save(pendingAsset, { manager });
        const savedUser = await this.userRepository.save(user, { manager });
        await this.outboxWriter.storeEvents(user.pullDomainEvents(), {
          manager,
        });

        return savedUser;
      });
    } catch (error) {
      await this.compensateUploadedObject(asset.id, input.userId);
      throw error;
    }

    try {
      await this.userCacheInvalidator.invalidate(updatedUser);
    } catch (error) {
      this.logger.error(
        `Avatar updated but user cache invalidation failed userId=${input.userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return {
      assetId: asset.id,
      url: this.objectStorage.buildPublicUrl({
        bucket: asset.bucket,
        key: asset.storageKey,
      }),
    };
  }

  private async recordUploadFailure(
    assetId: string,
    userId: string,
    error: unknown,
  ): Promise<void> {
    try {
      const failedAsset = await this.assetRepository.findByIdAndUserId(
        assetId,
        userId,
      );

      if (!failedAsset) {
        return;
      }

      const failureCode =
        error instanceof ObjectStorageError
          ? error.code
          : "OBJECT_STORAGE_UNKNOWN";
      failedAsset.markFailed(failureCode);
      await this.assetRepository.save(failedAsset);
    } catch (persistenceError) {
      this.logger.error(
        `Could not mark avatar asset as failed assetId=${assetId}`,
        persistenceError instanceof Error ? persistenceError.stack : undefined,
      );
    }
  }

  private async compensateUploadedObject(
    assetId: string,
    userId: string,
  ): Promise<void> {
    const pendingAsset = await this.assetRepository.findByIdAndUserId(
      assetId,
      userId,
    );

    if (!pendingAsset) {
      return;
    }

    try {
      await this.objectStorage.deleteObject({
        bucket: pendingAsset.bucket,
        key: pendingAsset.storageKey,
      });
    } catch (error) {
      this.logger.error(
        `Could not compensate uploaded avatar assetId=${assetId}`,
        error instanceof Error ? error.stack : undefined,
      );

      return;
    }

    try {
      pendingAsset.markFailed("DATABASE_FINALIZATION_FAILED");
      await this.assetRepository.save(pendingAsset);
    } catch (error) {
      this.logger.error(
        `Could not mark compensated avatar asset as failed assetId=${assetId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
```

### Por Que O Evento É Drenado Do `user`

`User.changeAvatarAsset()` registra o evento no aggregate em memória. `userRepository.save()` retorna uma nova entidade reconstituída e ela não possui os eventos pendentes. Por isso o código usa:

```ts
await this.userRepository.save(user, { manager });
await this.outboxWriter.storeEvents(user.pullDomainEvents(), { manager });
```

Não use `savedUser.pullDomainEvents()`.

### Sobre A Compensação

Se o R2 aceitou o objeto, mas a transação falhou, a linha continua `PENDING_UPLOAD` porque `markReady()` sofreu rollback. A compensação tenta apagar o objeto e marcar a linha como `FAILED`.

Ela é best effort. Se apagar ou atualizar o banco falhar, o job futuro de reconciliação encontra o registro antigo e resolve. Não substitua reconciliação por uma falsa tentativa de transação distribuída entre PostgreSQL e R2.

## 8. Response DTO

Arquivo: `api/src/modules/users/presentation/dto/update-user-avatar.response.dto.ts`

```ts
import { UpdateUserAvatarOutput } from "@/modules/users/application/use-cases/update-user-avatar/update-user-avatar.dto";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateUserAvatarResponseDto {
  @ApiProperty({ format: "uuid" })
  assetId!: string;

  @ApiProperty({ format: "uri" })
  url!: string;

  static fromOutput(
    output: UpdateUserAvatarOutput,
  ): UpdateUserAvatarResponseDto {
    return {
      assetId: output.assetId,
      url: output.url,
    };
  }
}
```

## 9. Controller

Adicione ao `UsersController`:

```ts
import { USER_AVATAR_MAX_INPUT_BYTES } from "@/common/models/constants";
import { UpdateUserAvatarUseCase } from "@/modules/users/application/use-cases/update-user-avatar/update-user-avatar.use-case";
import { UpdateUserAvatarResponseDto } from "@/modules/users/presentation/dto/update-user-avatar.response.dto";
import {
  ParseFilePipeBuilder,
  Put,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes } from "@nestjs/swagger";
```

Injete o use case no construtor e adicione a rota:

```ts
@Put('me/avatar')
@ApiCookieAuth('accessToken')
@ApiConsumes('multipart/form-data')
@ApiOperation({ summary: 'Atualizar avatar do usuário autenticado' })
@ApiBody({
  schema: {
    type: 'object',
    required: ['file'],
    properties: {
      file: {
        type: 'string',
        format: 'binary',
      },
    },
  },
})
@ApiResponse({ status: 200, type: UpdateUserAvatarResponseDto })
@ApiResponse({ status: 400, type: PlatformErrorResponseDto })
@ApiResponse({ status: 401, type: PlatformErrorResponseDto })
@ApiResponse({ status: 413, type: PlatformErrorResponseDto })
@ApiResponse({ status: 415, type: PlatformErrorResponseDto })
@ApiResponse({ status: 422, type: PlatformErrorResponseDto })
@ApiResponse({ status: 503, type: PlatformErrorResponseDto })
@UseInterceptors(
  FileInterceptor('file', {
    limits: {
      files: 1,
      fileSize: USER_AVATAR_MAX_INPUT_BYTES,
    },
  }),
)
async updateAvatar(
  @CurrentUser() user: User,
  @UploadedFile(
    new ParseFilePipeBuilder()
      .addMaxSizeValidator({ maxSize: USER_AVATAR_MAX_INPUT_BYTES })
      .build({ fileIsRequired: true }),
  )
  file: Express.Multer.File,
): Promise<UpdateUserAvatarResponseDto> {
  const output = await this.updateUserAvatarUseCase.execute({
    userId: user.id,
    bytes: file.buffer,
  });

  return UpdateUserAvatarResponseDto.fromOutput(output);
}
```

Não adicione `FileTypeValidator` confiando no MIME declarado. O processor faz a validação real pelos bytes. O limite aparece no Multer e no processor por defesa em profundidade.

## 10. Module Wiring

Atualize `UsersModule`.

Imports adicionais:

```ts
import { AssetsModule } from "@/modules/assets/assets.module";
import { IAvatarImageProcessor } from "@/modules/users/application/ports/avatar-image-processor.interface";
import { IUserCacheInvalidator } from "@/modules/users/application/ports/user-cache-invalidator.interface";
import { UpdateUserAvatarUseCase } from "@/modules/users/application/use-cases/update-user-avatar/update-user-avatar.use-case";
import { RedisUserCacheInvalidator } from "@/modules/users/infrastructure/cache/redis-user-cache-invalidator";
import { SharpAvatarImageProcessor } from "@/modules/users/infrastructure/image-processing/sharp-avatar-image.processor";
import { ObjectStorageModule } from "@/shared/object-storage";
```

Configuração:

```ts
@Module({
  imports: [
    TypeOrmModule.forFeature([UserOrmEntity, AuthProviderOrmEntity]),
    AssetsModule,
    ObjectStorageModule,
    OutboxModule,
  ],
  controllers: [UsersController],
  providers: [
    {
      provide: IUserRepository,
      useClass: CachedUserRepository,
    },
    {
      provide: IAvatarImageProcessor,
      useClass: SharpAvatarImageProcessor,
    },
    {
      provide: IUserCacheInvalidator,
      useClass: RedisUserCacheInvalidator,
    },
    UserRepository,
    UpdateUserAvatarUseCase,
    // demais providers atuais
  ],
})
export class UsersModule {}
```

`AssetsModule` já exporta `IAssetRepository`. `ObjectStorageModule` exporta `IObjectStorage`. `OutboxModule` é global, mas manter o import explícito em `UsersModule` deixa a dependência arquitetural visível e segue o módulo atual.

## 11. Testes Do Processor

Arquivo: `api/src/modules/users/infrastructure/image-processing/sharp-avatar-image.processor.spec.ts`

Casos mínimos:

```ts
describe("SharpAvatarImageProcessor", () => {
  it("converts an accepted image to a 512x512 webp");
  it("uses the bytes instead of a client-provided MIME type");
  it("rejects an unsupported file signature");
  it("rejects input larger than 5 MB");
  it("rejects corrupted image bytes");
  it("returns a lowercase SHA-256 checksum for the generated bytes");
});
```

Gere uma imagem pequena durante o teste com Sharp. Não dependa de arquivo externo salvo no repositório quando alguns bytes gerados forem suficientes.

## 12. Testes Do Use Case

Arquivo: `api/src/modules/users/application/use-cases/update-user-avatar/update-user-avatar.use-case.spec.ts`

Mocke portas, não SDK S3 nem repositories TypeORM concretos.

Casos mínimos:

```ts
describe("UpdateUserAvatarUseCase", () => {
  it(
    "uploads the normalized image and commits asset, user and outbox together",
  );
  it("uses the authenticated userId for asset ownership and storage metadata");
  it(
    "marks the pending asset as failed when Object Storage rejects the upload",
  );
  it("does not open a database transaction when image validation fails");
  it("deletes the uploaded object when database finalization fails");
  it("does not update User before Asset becomes ready");
  it("drains domain events from the locked aggregate");
  it("invalidates user cache only after the transaction resolves");
  it("returns the public URL built by IObjectStorage");
});
```

Para simular a transação:

```ts
const manager = {} as EntityManager;
const dataSource = {
  transaction: jest.fn(async (callback) => callback(manager)),
} as unknown as DataSource;
```

Além dos unitários, o lock concorrente merece um teste de integração com PostgreSQL real. SQLite não reproduz `pessimistic_write` nem o comportamento de concorrência necessário.

## 13. Swagger E Integração

Depois de a rota funcionar, documente em `docs/integrations/users/update-avatar.md`:

- método e rota;
- autenticação por cookie;
- campo multipart `file`;
- máximo de 5 MB;
- formatos de entrada aceitos;
- saída sempre WebP 512x512;
- shape `{ assetId, url }`;
- códigos `AVATAR_FILE_TOO_LARGE`, `UNSUPPORTED_AVATAR_FILE`, `INVALID_AVATAR_IMAGE`, `AVATAR_UPLOAD_FAILED`, `USER_NOT_FOUND`;
- natureza assíncrona da remoção do avatar anterior.

Também atualize `docs/integrations/errors.md` e o Swagger da rota.

## 14. Pontos Que Eu Revisaria No Seu PR

- `userId` vem de `@CurrentUser()`, nunca do multipart;
- bucket e key são definidos pelo backend;
- formato é detectado pelos bytes;
- nenhum upload maior que 5 MB permanece inteiro além do buffer já controlado pelo Multer;
- R2 não é chamado dentro da transação PostgreSQL;
- o usuário só aponta para asset `READY`;
- lock é adquirido antes de ler `previousAssetId`;
- asset, user e outbox usam o mesmo `EntityManager`;
- eventos são drenados do aggregate manipulado;
- falha depois do upload possui compensação e reconciliação futura;
- cache não recebe estado antes do commit;
- erros externos não vazam detalhes ao frontend;
- o consumidor futuro de `user.avatar.updated` é idempotente.

## Próxima Etapa

Depois deste use case, implemente separadamente o consumidor de `user.avatar.updated`. Ele não deve fazer parte da requisição HTTP: sua responsabilidade será marcar `previousAssetId` como `DELETE_PENDING`, apagar o objeto de forma idempotente e marcar o asset como `DELETED`.
