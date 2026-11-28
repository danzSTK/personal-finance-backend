---
area: fiscal-notes
type: integration
status: current
---

# Fiscal Notes Integration

Este documento descreve como o frontend deve consumir os endpoints HTTP do módulo `fiscal-notes` para leitura, pré-visualização, importação, vínculo, listagem e desvínculo de **NFC-e** (Nota Fiscal de Consumidor Eletrônica).

Para regras de negócio, arquitetura e detalhes operacionais, consulte [Fiscal notes architecture](../../fiscal-notes/README.md) e [HTTP and Error Contracts](../../fiscal-notes/reference/http-and-error-contracts.md).

## Autenticação e CSRF

Todas as rotas exigem sessão autenticada com e-mail verificado via cookies HttpOnly (`accessToken`).

Use sempre:

- `credentials: 'include'` no `fetch`;
- `withCredentials: true` no `axios`.

O `userId` sempre é extraído da sessão autenticada; o frontend nunca deve enviar `userId`.

Rotas mutáveis (`POST` e `DELETE`) passam pela validação de origem (`OriginGuard` / `CSRF_ALLOWED_ORIGINS`), além do limite HTTP por rota (`10 req / 60s` em `preview`, `import` e vínculo).

## Escopo Atual (V1)

- **Modelo fiscal suportado:** apenas **NFC-e** (modelo `65` nas posições 21–22 da chave de acesso). NF-e modelo `55` e outros modelos são rejeitados com `400 FISCAL_NOTE_INVALID_INPUT`.
- **UF suportada:** apenas Ceará (**UF `23`**, SEFAZ-CE). Chaves válidas de outras UFs retornam `422 FISCAL_NOTE_UNSUPPORTED_UF`.
- **Ambiente:** apenas **Produção** (`ambiente = 1`). Notas emitidas em homologação (`ambiente = 2`) retornam `422 FISCAL_NOTE_HOMOLOGATION_NOT_ALLOWED`.
- **Privacidade (Zero-PII / LGPD):** dados do bloco `Consumidor` (como CPF/nome do comprador) são descartados antes do cache e nunca são persistidos ou retornados pela API.

## Formatos de Entrada Aceitos (`input`)

Os endpoints de pré-visualização, importação e vínculo aceitam o campo `input` (string não vazia de até `1024` caracteres) em qualquer um dos seguintes formatos:

| Formato | Exemplo | Observações |
| --- | --- | --- |
| URL HTTP/HTTPS do QR Code | `http://nfce.sefaz.ce.gov.br/nfce/pagina?p=23261003539462000250651030000760541443208780\|2\|1\|1\|HASH` | Extrai apenas `hostname` e o parâmetro `p` (case-insensitive). O backend **nunca** requisita a URL enviada pelo cliente (proteção anti-SSRF). |
| Payload cru `p` (v2 normal, 5 campos) | `23261003539462000250651030000760541443208780\|2\|1\|1\|HASH` | Formato `chave\|2\|ambiente\|idCSC\|hash`. |
| Payload cru `p` (v2 contingência, 8 campos) | `23261003539462000250651030000760541443208780\|2\|1\|15\|3141\|\|1\|HASH` | Formato `chave\|2\|ambiente\|diaEmissao\|valorTotal\|digVal\|idCSC\|hash`. Aceita `digVal` vazio (`\|\|`), realizando fallback interno para consulta v3 por chave na SEFAZ-CE. |
| Payload cru `p` (v3, mínimo 3 campos) | `23261003539462000250651030000760541443208780\|3\|1` | Formato `chave\|3\|ambiente`. |
| Chave de acesso de 44 dígitos | `2326 1003 5394 6200 0250 6510 3000 0760 5414 4320 8780` | Caracteres não numéricos são removidos antes da validação. Assume ambiente de produção (`1`). |

Toda entrada passa por validação local *fail-fast* (44 dígitos numéricos, modelo `65`, dígito verificador módulo 11 e UF `23`) antes de consultar cache Redis ou SEFAZ.

## Endpoints

| Método e Rota | Throttle | Status | `object` da Resposta | Finalidade |
| --- | --- | --- | --- | --- |
| `POST /fiscal-notes/preview` | `10 / 60s` | `200 OK` | `fiscal_note.preview` | Pré-visualiza dados sanitizados, duplicidade e sugestão de despesa |
| `POST /fiscal-notes/import` | `10 / 60s` | `201 Created` | `fiscal_note.import` | Cria atomicamente `Transaction (EXPENSE)` + `FiscalNote` |
| `POST /transactions/:id/fiscal-note` | `10 / 60s` | `201 Created` | `fiscal_note.item` | Vincula `FiscalNote` a uma `EXPENSE` existente sem sobrescrevê-la |
| `GET /fiscal-notes` | padrão global | `200 OK` | `fiscal_note.list` | Lista notas ativas com filtros, paginação e totais agregados |
| `GET /fiscal-notes/:id` | padrão global | `200 OK` | `fiscal_note.item` | Consulta detalhe completo de uma nota fiscal ativa por UUID |
| `GET /transactions/:id/fiscal-note` | padrão global | `200 OK` | `fiscal_note.item` | Consulta detalhe completo da nota fiscal ativa vinculada à transação |
| `DELETE /transactions/:id/fiscal-note` | padrão global | `204 No Content` | — | Desvincula (soft delete) a nota fiscal preservando a transação |

---

## 1. Pré-visualizar NFC-e (`POST /fiscal-notes/preview`)

Valida a entrada, consulta cache Redis ou SEFAZ-CE em caso de *cache miss* e retorna os dados da nota sem gravar nada no banco. Também informa se o usuário já importou aquela chave anteriormente (`alreadyImported`).

### Request

```http
POST /fiscal-notes/preview
Content-Type: application/json
```

```json
{
  "input": "http://nfce.sefaz.ce.gov.br/nfce/pagina?p=23261003539462000250651030000760541443208780|2|1|1|HASH"
}
```

### Response (`200 OK`)

```json
{
  "object": "fiscal_note.preview",
  "alreadyImported": false,
  "existingTransactionId": null,
  "existingFiscalNoteId": null,
  "cacheHit": false,
  "suggestedTransaction": {
    "type": "EXPENSE",
    "status": "EFFECTIVE",
    "amountCents": 3141,
    "date": "2026-10-15",
    "description": "SUPERMERCADO EXEMPLO LTDA"
  },
  "fiscalNote": {
    "accessKey": "23261003539462000250651030000760541443208780",
    "sourceUf": "23",
    "number": "76054",
    "series": "103",
    "issuedAt": "2026-10-15T17:32:10.000Z",
    "issuedDate": "2026-10-15",
    "protocol": "223260123456789",
    "issuerName": "SUPERMERCADO EXEMPLO LTDA",
    "issuerCnpj": "03539462000250",
    "issuerAddress": "AV BEZERRA DE MENEZES, 1000, FORTALEZA, CE",
    "grossAmountCents": 4013,
    "discountAmountCents": 872,
    "payableAmountCents": 3141,
    "taxAmountCents": 1051,
    "changeAmountCents": null,
    "xmlVersion": "4.00",
    "xsltVersion": "2.05",
    "parserVersion": "sefaz-ce-html-v1",
    "items": [
      {
        "position": 1,
        "rawDescription": "QUEIJO MUSSARELA FATIADO",
        "storeCode": "1001",
        "unit": "KG",
        "quantity": 0.468,
        "unitPrice": 26.99,
        "totalPriceCents": 1263
      }
    ],
    "payments": [
      {
        "position": 1,
        "methodLabel": "Cartão de Débito",
        "amountCents": 3141
      }
    ]
  }
}
```

---

## 2. Importar NFC-e Criando Despesa (`POST /fiscal-notes/import`)

Cria atomicamente uma nova `Transaction` (`type = "EXPENSE"`) e a `FiscalNote` correspondente (com itens e pagamentos).

### Request

```http
POST /fiscal-notes/import
Content-Type: application/json
```

```json
{
  "input": "http://nfce.sefaz.ce.gov.br/nfce/pagina?p=23261003539462000250651030000760541443208780|2|1|1|HASH",
  "accountId": "a6e1a79f-6fbd-441d-93b7-458de6cf1f35",
  "categoryId": "4d8d1ac9-6ce7-4d51-8899-6e9dfd430952",
  "amountCents": 3141,
  "date": "2026-10-15",
  "description": "SUPERMERCADO EXEMPLO LTDA",
  "status": "EFFECTIVE"
}
```

#### Campos do Body

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `input` | `string` | Sim | URL/payload do QR Code ou chave de acesso de 44 dígitos (máx. 1024 caracteres). |
| `accountId` | `string (uuid)` | Sim | ID de uma account ativa do usuário autenticado. |
| `categoryId` | `string (uuid)` | Sim | ID de uma categoria ativa compatível com `EXPENSE`. |
| `amountCents` | `integer` | Não | Override positivo em centavos (`>= 1`). Quando omitido, usa `payableAmountCents` da nota (obrigatório caso `payableAmountCents === 0`). Não aceita `null`. |
| `date` | `DateOnly` (`YYYY-MM-DD`) | Não | Override da data civil da despesa. Quando omitido, usa `issuedDate` da nota. Não aceita `null`. |
| `description` | `string \| null` | Não | Descrição da transação (máx. 500 caracteres). Quando omitida, usa `issuerName` truncado a 500 caracteres. |
| `status` | `EFFECTIVE \| PENDING` | Não | Status inicial da despesa. Padrão: `EFFECTIVE`. Não aceita `null`. |

### Response (`201 Created`)

```json
{
  "object": "fiscal_note.import",
  "transaction": {
    "id": "2f9f2b7d-881e-41bd-9cde-27f7e10f30f0",
    "accountId": "a6e1a79f-6fbd-441d-93b7-458de6cf1f35",
    "destinationAccountId": null,
    "categoryId": "4d8d1ac9-6ce7-4d51-8899-6e9dfd430952",
    "type": "EXPENSE",
    "status": "EFFECTIVE",
    "amountCents": 3141,
    "date": "2026-10-15",
    "effectiveAt": "2026-10-15T17:35:00.000Z",
    "description": "SUPERMERCADO EXEMPLO LTDA",
    "direction": null,
    "attachmentsCount": 0,
    "hasFiscalNote": true,
    "createdAt": "2026-10-15T17:35:00.000Z",
    "updatedAt": "2026-10-15T17:35:00.000Z"
  },
  "fiscalNote": {
    "object": "fiscal_note.item",
    "id": "8e1c9d20-41aa-4f82-9a14-12f3a4b5c6d7",
    "transactionId": "2f9f2b7d-881e-41bd-9cde-27f7e10f30f0",
    "accessKey": "23261003539462000250651030000760541443208780",
    "sourceUf": "23",
    "number": "76054",
    "series": "103",
    "issuedAt": "2026-10-15T17:32:10.000Z",
    "protocol": "223260123456789",
    "issuerName": "SUPERMERCADO EXEMPLO LTDA",
    "issuerCnpj": "03539462000250",
    "issuerAddress": "AV BEZERRA DE MENEZES, 1000, FORTALEZA, CE",
    "grossAmountCents": 4013,
    "discountAmountCents": 872,
    "payableAmountCents": 3141,
    "taxAmountCents": 1051,
    "changeAmountCents": null,
    "xmlVersion": "4.00",
    "xsltVersion": "2.05",
    "parserVersion": "sefaz-ce-html-v1",
    "items": [
      {
        "id": "7f3a1b2c-1122-4334-8556-778899aabbcc",
        "position": 1,
        "rawDescription": "QUEIJO MUSSARELA FATIADO",
        "storeCode": "1001",
        "unit": "KG",
        "quantity": 0.468,
        "unitPrice": 26.99,
        "totalPriceCents": 1263
      }
    ],
    "payments": [
      {
        "id": "9a0b1c2d-3344-4556-8778-99aabbccddee",
        "position": 1,
        "methodLabel": "Cartão de Débito",
        "amountCents": 3141
      }
    ],
    "createdAt": "2026-10-15T17:35:00.000Z",
    "updatedAt": "2026-10-15T17:35:00.000Z"
  }
}
```

---

## 3. Vincular NFC-e a Despesa Existente (`POST /transactions/:id/fiscal-note`)

Vincula uma NFC-e a uma transação existente do tipo `EXPENSE` que ainda não possua nota fiscal ativa. Não altera `amountCents`, `date`, `description`, `accountId`, `categoryId` ou `status` da transação.

> **Atenção:** o vínculo é feito em `POST /transactions/:id/fiscal-note` (não existe rota `POST /fiscal-notes/link`).

### Request

```http
POST /transactions/2f9f2b7d-881e-41bd-9cde-27f7e10f30f0/fiscal-note
Content-Type: application/json
```

```json
{
  "input": "23261003539462000250651030000760541443208780"
}
```

### Response (`201 Created`)

Retorna `FiscalNoteResponseDto` com `object: "fiscal_note.item"` (mesma estrutura de `fiscalNote` exibida em `POST /fiscal-notes/import`).

---

## 4. Listar Notas Fiscais (`GET /fiscal-notes`)

Retorna listagem paginada leve das notas fiscais ativas do usuário autenticado, sem os arrays `items` e `payments` (expondo `itemsCount`), além dos totais agregados do recorte filtrado.

### Query Parameters

| Parâmetro | Tipo | Padrão | Descrição |
| --- | --- | --- | --- |
| `issuedFrom` | `DateOnly` (`YYYY-MM-DD`) | — | Data civil inicial de emissão (fuso `-03:00`). Deve ser `<= issuedTo`. |
| `issuedTo` | `DateOnly` (`YYYY-MM-DD`) | — | Data civil final de emissão (fuso `-03:00`). |
| `issuerCnpj` | `string` | — | CNPJ do emitente (14 dígitos numéricos ou formatado com `./-` e espaços). |
| `sourceUf` | `string` | — | Código IBGE de 2 dígitos da UF emissora (ex.: `23`). |
| `minAmountCents` | `integer` (`>= 0`) | — | Valor mínimo a pagar em centavos. Deve ser `<= maxAmountCents`. |
| `maxAmountCents` | `integer` (`>= 0`) | — | Valor máximo a pagar em centavos. |
| `search` | `string` (máx. 120) | — | Busca case-insensitive no nome do emitente ou na descrição dos itens. |
| `page` | `integer` (`>= 1`) | `1` | Número da página. |
| `limit` | `integer` (`1..100`) | `20` | Itens por página. |
| `sort` | `enum` | `issuedAt:desc` | `issuedAt:desc`, `issuedAt:asc`, `payableAmountCents:desc`, `payableAmountCents:asc`, `createdAt:desc`, `createdAt:asc`. |

### Response (`200 OK`)

```json
{
  "object": "fiscal_note.list",
  "data": [
    {
      "object": "fiscal_note.summary",
      "id": "8e1c9d20-41aa-4f82-9a14-12f3a4b5c6d7",
      "transactionId": "2f9f2b7d-881e-41bd-9cde-27f7e10f30f0",
      "accessKey": "23261003539462000250651030000760541443208780",
      "sourceUf": "23",
      "number": "76054",
      "series": "103",
      "issuedAt": "2026-10-15T17:32:10.000Z",
      "issuerName": "SUPERMERCADO EXEMPLO LTDA",
      "issuerCnpj": "03539462000250",
      "grossAmountCents": 4013,
      "discountAmountCents": 872,
      "payableAmountCents": 3141,
      "taxAmountCents": 1051,
      "itemsCount": 6,
      "createdAt": "2026-10-15T17:35:00.000Z",
      "updatedAt": "2026-10-15T17:35:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "summary": {
    "object": "fiscal_note.summary_totals",
    "totalNotes": 1,
    "totalGrossAmountCents": 4013,
    "totalDiscountAmountCents": 872,
    "totalPayableAmountCents": 3141,
    "totalTaxAmountCents": 1051
  }
}
```

---

## 5. Consultar Detalhe por ID (`GET /fiscal-notes/:id`)

Retorna os detalhes completos (cabeçalho, `items` e `payments` ordenados por `position ASC`) de uma nota fiscal ativa do usuário autenticado.

### Request

```http
GET /fiscal-notes/8e1c9d20-41aa-4f82-9a14-12f3a4b5c6d7
```

### Response (`200 OK`)

Retorna `FiscalNoteResponseDto` com `object: "fiscal_note.item"`.

---

## 6. Consultar Nota pela Transação (`GET /transactions/:id/fiscal-note`)

Retorna os detalhes completos (`object: "fiscal_note.item"`) da nota fiscal ativa vinculada à transação `:id`.

Quando `TransactionResponseDto.hasFiscalNote` for `false`, o frontend não precisa chamar este endpoint. Caso seja chamado sem nota ativa vinculada (ou para transação inexistente/de outro usuário), retorna `404`.

### Request

```http
GET /transactions/2f9f2b7d-881e-41bd-9cde-27f7e10f30f0/fiscal-note
```

### Response (`200 OK`)

Retorna `FiscalNoteResponseDto` com `object: "fiscal_note.item"`.

---

## 7. Desvincular Nota da Transação (`DELETE /transactions/:id/fiscal-note`)

Realiza *soft delete* apenas da nota fiscal vinculada à transação `:id`. A transação permanece intacta, a chave de acesso volta a ficar livre para reimportação pelo usuário e a transação pode receber outro vínculo no futuro.

### Request

```http
DELETE /transactions/2f9f2b7d-881e-41bd-9cde-27f7e10f30f0/fiscal-note
```

### Response (`204 No Content`)

Sem body.

---

## Regras de Ciclo de Vida e Cache no Frontend

- **Alteração de tipo da transação:** uma transação com `hasFiscalNote: true` não pode ter seu `type` alterado para `INCOME`, `TRANSFER` ou `ADJUSTMENT` (`409 TRANSACTION_TYPE_DOES_NOT_SUPPORT_FISCAL_NOTE`); desvincule a nota antes se necessário.
- **Exclusão da transação (`DELETE /transactions/:id`):** remove também (via *soft delete* na mesma transação do banco) a nota fiscal vinculada, liberando a chave de acesso para eventual reimportação.
- **Invalidação de cache:** após `import`, `POST /transactions/:id/fiscal-note`, `DELETE /transactions/:id/fiscal-note` ou `DELETE /transactions/:id`, invalide as queries de transações (`['transactions']`) e de notas fiscais (`['fiscal-notes']`) para manter `hasFiscalNote`, saldos e listagens sincronizados.

## Erros Esperados

Todos os erros seguem o contrato global documentado em [Error Contract](../errors.md).

| Code | HTTP Status | `details` / Headers | Quando |
| --- | ---: | --- | --- |
| `VALIDATION_ERROR` | `400` | `details.fields` | Campos do body/query ou UUID de rota falham na validação de DTO. |
| `FISCAL_NOTE_INVALID_INPUT` | `400` | `details: null` | Entrada vazia, `> 1024` chars, URL não HTTP/HTTPS, `p` ausente/malformado, chave != 44 dígitos, modelo != `65`, DV mod-11 inválido ou faixas inválidas em `GET /fiscal-notes` (`issuedFrom > issuedTo` ou `minAmountCents > maxAmountCents`). |
| `INVALID_FISCAL_NOTE` | `400` | `details: null` | Violação de invariante de domínio em nota, item ou pagamento. |
| `INVALID_TRANSACTION` | `400` | `details: null` | `amountCents` efetivo inválido no `import` (ex.: nota com `payableAmountCents === 0` sem override positivo). |
| `TRANSACTION_CATEGORY_INCOMPATIBLE` | `400` | `details: null` | Categoria informada no `import` não é compatível com `EXPENSE`. |
| `UNAUTHORIZED` | `401` | `details: null` | Sessão ausente, inválida ou expirada. |
| `FISCAL_NOTE_NOT_FOUND` | `404` | `details: null` | Nota fiscal não encontrada em `GET /fiscal-notes/:id` ou transação sem nota ativa em `GET`/`DELETE /transactions/:id/fiscal-note`. |
| `FISCAL_NOTE_SEFAZ_NOT_FOUND` | `404` | `details: null` | SEFAZ retornou nota inexistente ou QR Code inválido. |
| `TRANSACTION_NOT_FOUND` | `404` | `details: null` | Transação inexistente, deletada ou de outro usuário. |
| `FISCAL_NOTE_ALREADY_IMPORTED` | `409` | `{ existingTransactionId, existingFiscalNoteId }` | Usuário já possui `FiscalNote` ativa com a mesma `accessKey`. |
| `TRANSACTION_ALREADY_HAS_FISCAL_NOTE` | `409` | `{ existingFiscalNoteId }` | Transação já possui uma `FiscalNote` ativa vinculada. |
| `TRANSACTION_TYPE_DOES_NOT_SUPPORT_FISCAL_NOTE` | `409` | `details: null` | Tentativa de vincular nota a transação não-`EXPENSE` ou de mudar o `type` de uma transação com nota ativa. |
| `TRANSACTION_ACCOUNT_UNAVAILABLE` | `409` | `details: null` | Account informada no `import` não existe, está arquivada ou indisponível. |
| `TRANSACTION_CATEGORY_UNAVAILABLE` | `409` | `details: null` | Categoria informada no `import` não existe, está arquivada ou indisponível. |
| `FISCAL_NOTE_UNSUPPORTED_UF` | `422` | `details: null` | UF da chave de acesso não é suportada na V1 (`uf !== '23'`). |
| `FISCAL_NOTE_HOMOLOGATION_NOT_ALLOWED` | `422` | `details: null` | Nota emitida em ambiente de homologação (`ambiente = 2`). |
| `FISCAL_NOTE_CANCELLED_OR_DENIED` | `422` | `details: null` | Nota cancelada ou denegada na SEFAZ. |
| `FISCAL_NOTE_RATE_LIMIT_EXCEEDED` | `429` | `{ retryAfterSeconds }` + header `Retry-After` | Usuário excedeu a cota de consultas SEFAZ em *cache miss* (`5/1m` ou `30/1h`). |
| `TOO_MANY_REQUESTS` | `429` | `details: null` | Throttling HTTP da rota excedido (`10 req / 60s` em `preview`, `import` ou vínculo). |
| `FISCAL_NOTE_PARSE_FAILED` | `502` | `details: null` | Resposta da SEFAZ inválida, HTML quebrado ou falha de integridade pós-parsing. |
| `FISCAL_NOTE_RESPONSE_TOO_LARGE` | `502` | `details: null` | Resposta HTTP da SEFAZ excedeu o limite rígido de 1 MB. |
| `SEFAZ_TEMPORARILY_UNAVAILABLE` | `503` | `{ retryAfterSeconds }` + header `Retry-After` | Circuit Breaker `OPEN`, cota global por UF excedida ou falha/5xx da SEFAZ. |
| `SEFAZ_TIMEOUT` | `504` | `details: null` | Timeout na consulta à SEFAZ após tentativa inicial e 1 retry. |
