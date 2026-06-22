---
area: storage
type: architecture
status: current
related:
  - ../assets/README.md
  - ./Dados%20iniciais%20%28manuais%29.md
---

# Object Storage

Object Storage é uma capacidade técnica compartilhada para armazenar e remover objetos binários fora do PostgreSQL. A primeira implementação usará o SDK S3 da AWS contra a API compatível com S3 da Cloudflare R2.

Esta camada não é um domínio de negócio. Ela não sabe o que é usuário, avatar, comprovante ou anexo. Esses significados pertencem aos módulos consumidores e ao [módulo Assets](../assets/README.md).

## Responsabilidade

Object Storage deve:

- esconder SDK, endpoint, credenciais e detalhes específicos do R2;
- oferecer um contrato pequeno para operações sobre bucket e key;
- receber bucket e key já definidos pela aplicação;
- enviar e remover bytes;
- consultar a existência e, quando necessário, metadata técnica do objeto;
- construir a URL pública usando configuração do ambiente;
- traduzir falhas do SDK para erros técnicos conhecidos pela aplicação;
- permitir substituir o provider sem contaminar módulos consumidores.

Object Storage não deve:

- persistir linhas em `assets`;
- escolher `userId`, `purpose` ou status;
- gerar regras específicas de key para cada domínio;
- validar ownership;
- processar imagens com Sharp;
- validar tipos de arquivo com `file-type`;
- decidir o ciclo de troca de avatar;
- publicar eventos de domínio.

## Estrutura Planejada

```text
api/src/shared/object-storage/
├── object-storage.module.ts
├── object-storage.interface.ts
├── object-storage.tokens.ts
├── config/
│   └── object-storage.config.ts
└── providers/
    └── s3-object-storage.provider.ts
```

`ObjectStorageModule` será infraestrutura compartilhada porque vários módulos poderão armazenar objetos, mas somente um adapter deve conhecer `@aws-sdk/client-s3`.

## Contrato Planejado

O port deve trabalhar com conceitos técnicos e não com entidades de domínio:

- colocar um objeto em `bucket + key`;
- remover um objeto de forma idempotente;
- verificar se um objeto existe;
- obter metadata técnica quando uma reconciliação precisar;
- montar URL pública sem persistir essa URL.

O contrato não deve receber `Asset`, `User` ou DTO HTTP.

## Cloudflare R2

Decisões iniciais:

- usar compatibilidade S3 por meio do SDK oficial da AWS;
- configurar endpoint, account id, access key, secret e bucket fora do código;
- manter o bucket público para os primeiros assets públicos;
- não usar presigned upload na primeira versão;
- não persistir endpoint nem URL pública no banco;
- não colocar o nome do bucket dentro da storage key.

## URL Pública

O R2 guarda o objeto em `bucket + key`. A URL é derivada em tempo de resposta:

```text
{publicBaseUrl}/{storageKey}
```

`publicBaseUrl` é o domínio público conectado ao bucket público e, por isso, o nome do bucket não aparece novamente no path. O adapter rejeita a construção de URL pública para qualquer bucket diferente do `publicBucketName` configurado.

Separar `publicBaseUrl` da key permite trocar domínio público, CDN ou configuração do ambiente sem atualizar todas as linhas de `assets`.

## Checksum

A plataforma mantém SHA-256 em hexadecimal minúsculo no domínio e no PostgreSQL. O header S3 `ChecksumSHA256` exige Base64, então o adapter valida o hexadecimal e converte somente na fronteira antes do `PutObjectCommand`.

## Falhas E Observabilidade

Erros brutos do SDK não atravessam o contrato. O adapter os traduz para `ObjectStorageError`, incluindo operação, código técnico, retry, status HTTP do provider, request id e quantidade de tentativas quando disponíveis.

Casos esperados não são tratados como falha:

- `HEAD` de objeto ausente retorna `null`;
- `DELETE` de objeto ausente retorna sucesso idempotente.

Falhas de acesso, configuração, rate limit, indisponibilidade, timeout e rede recebem códigos técnicos diferentes. A camada de aplicação decidirá como convertê-los em estado do asset ou `ApplicationError`.

Logs podem conter operação, bucket, key, request id e código técnico. Nunca devem conter credenciais, corpo completo do objeto ou segredo retornado pelo provider.

## Consumidores

Cada consumidor define seus próprios limites e processamento antes de chamar Object Storage. O primeiro fluxo planejado é [Update user avatar](../users/flows/update-user-avatar.md), que limita imagens a 5 MB e usa Sharp e `file-type`. Essas regras não pertencem ao adapter R2.

## Estado Atual

Já existem:

- contrato `IObjectStorage`;
- adapter `S3ObjectStorageAdapter`;
- provider configurado do `S3Client`;
- configuração validada do R2;
- upload, head, delete e construção de URL pública;
- tradução tipada de falhas S3 e de rede;
- testes unitários do adapter e do mapper de erros.

Ainda não existem casos de uso que coordenem assets e Object Storage.
