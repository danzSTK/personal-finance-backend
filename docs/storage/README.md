---
area: storage
type: architecture
status: current
last_reviewed: 2026-07-23
related:
  - ../assets/README.md
  - ./Dados%20iniciais%20%28manuais%29.md
---

# Object Storage

Object Storage é uma capacidade técnica compartilhada para armazenar e remover objetos binários fora do PostgreSQL. A implementação atual usa o SDK S3 da AWS contra a API compatível com S3 da Cloudflare R2.

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

## Estrutura atual

```text
api/src/shared/object-storage/
├── object-storage.module.ts
├── object-storage.tokens.ts
├── adapters/
│   └── s3-object-storage.adapter.ts
├── contracts/
│   ├── object-storage.interface.ts
│   └── object-storage.types.ts
├── errors/
│   ├── object-storage-error.mapper.ts
│   └── object-storage.error.ts
└── providers/
    └── s3-client.provider.ts
```

`ObjectStorageModule` é infraestrutura compartilhada porque vários módulos podem armazenar objetos, mas somente o adapter conhece `@aws-sdk/client-s3`.

## Contrato atual

O port trabalha com conceitos técnicos e não com entidades de domínio:

- colocar um objeto em `bucket + key` com `Cache-Control` condicional por bucket;
- remover um objeto de forma idempotente;
- verificar se um objeto existe;
- obter metadata técnica quando uma reconciliação precisar;
- baixar bytes do objeto (`getObject`) para processamento e otimização assíncrona;
- montar URL pública sem persistir essa URL (`buildPublicUrl`);
- gerar URLs assinadas temporárias (`buildSignedReadUrl`) para leitura de objetos em bucket privado.

O contrato não deve receber `Asset`, `User` ou DTO HTTP.
## Cloudflare R2

Decisões iniciais:

- usar compatibilidade S3 por meio do SDK oficial da AWS;
- configurar endpoint, account id, access key, secret e bucket fora do código;
- operar com topologia de duplo bucket (Bucket Público e Bucket Privado);
- manter o bucket público para assets abertos (ex.: avatares) e bucket privado para dados sensíveis (ex.: anexos de transações);
- não usar presigned upload direto na API V0 (bytes transitam via API para validação de magic bytes e limites antes do R2);
- não persistir endpoint nem URLs completas no banco;
- não colocar o nome do bucket dentro da storage key.

## URL Pública

O R2 guarda o objeto em `bucket + key`. A URL é derivada em tempo de resposta:

```text
{publicBaseUrl}/{storageKey}
```

`publicBaseUrl` é o domínio público conectado ao bucket público e, por isso, o nome do bucket não aparece novamente no path. O adapter rejeita a construção de URL pública para qualquer bucket diferente do `publicBucketName` configurado.

Separar `publicBaseUrl` da key permite trocar domínio público, CDN ou configuração do ambiente sem atualizar todas as linhas de `assets`.


## Bucket Privado e Presigned URLs

Comprovantes de despesas e receitas contêm dados pessoais sensíveis (CPFs, nomes, chaves PIX e valores). Por isso, ficam confinados ao bucket privado (`R2_PRIVATE_BUCKET_NAME`).

O acesso aos objetos privados ocorre através de **Presigned URLs** geradas pelo `@aws-sdk/s3-request-presigner`:

- **Expiração no R2:** 300 segundos (5 minutos);
- **Cache Orientado ao Cliente (`cacheMaxAgeSeconds`):** 240 segundos (4 minutos) para sincronização e reuso seguro de cache no TanStack Query com margem de segurança de 60 segundos;
- **Isolamento de Segurança:** O método `buildSignedReadUrl` rejeita qualquer tentativa de emissão de URL assinada para buckets diferentes do bucket privado configurado (`PRIVATE_URL_UNAVAILABLE`).

## Políticas de Cache por Bucket

No envio (`putObject`), o adapter aplica headers `Cache-Control` distintos:

- **Bucket Público:** `Cache-Control: public, max-age=31536000, immutable` (assets imutáveis com cache longo de 1 ano em CDN e navegador);
- **Bucket Privado:** `Cache-Control: private, max-age=300` (impede cache compartilhado em proxies ou CDNs públicas e alinha à janela máxima de 5 minutos da URL assinada).
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

Cada consumidor define seus próprios limites e processamento antes de chamar Object Storage. O fluxo atual de [Update user avatar](../users/flows/update-user-avatar.md) limita imagens a 5 MB e usa Sharp e `file-type`. Essas regras não pertencem ao adapter R2.

## Estado Atual

Já existem:

- contrato `IObjectStorage`;
- adapter `S3ObjectStorageAdapter`;
- provider configurado do `S3Client`;
- configuração validada do R2;
- upload, head, delete e construção de URL pública;
- tradução tipada de falhas S3 e de rede;
- testes unitários do adapter e do mapper de erros;
- casos de uso de avatar que coordenam Assets e Object Storage;
- limpeza assíncrona do asset substituído ou removido.
