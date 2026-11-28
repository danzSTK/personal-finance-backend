---
area: fiscal-notes
type: concept
status: current
related:
  - ./fiscal-note-aggregate.md
  - ../flows/preview-and-resilience.md
  - ../decisions/html-scraping-sefaz-ce-without-raw-storage.md
---

# Input and Provider Strategy

`FiscalNoteInput` é o Value Object de fronteira responsável por normalizar, validar localmente e classificar a entrada fornecida pelo usuário antes de qualquer acesso a cache, rate limit ou provedor externo da SEFAZ.

A abstração de provedores (`IFiscalNoteProvider` e `IFiscalNoteProviderRegistry`) desacopla a regra de consulta de NFC-e dos detalhes HTTP e de parsing específicos de cada Secretaria da Fazenda estadual, permitindo adicionar novas UFs sem alterar casos de uso ou o domínio central.

`FiscalNoteInput` **nunca** executa chamadas de rede e **nunca** preserva a URL arbitrária enviada pelo cliente como destino de requisição HTTP.

## Formatos Aceitos e Canal de Consulta

O Value Object aceita uma string não vazia de até `1024` caracteres (`FISCAL_NOTE_INPUT_MAX_LENGTH`) e reconhece três representações:

| Formato de Entrada | Exemplo Resumido | Canal Resultante | Observações |
| --- | --- | --- | --- |
| URL HTTP/HTTPS do QR Code | `http://nfce.sefaz.ce.gov.br/...?p=CHAVE\|2\|1\|1\|HASH` | `qrcode_v2` ou `qrcode_v3` | Extrai apenas `hostname` e o parâmetro `p` (case-insensitive); esquema diferente de HTTP/HTTPS é rejeitado |
| Payload `p` direto (pipe-separated) | `2326...\|2\|1\|1\|HASH` | `qrcode_v2` ou `qrcode_v3` | Suporta v2 normal (5 campos), v2 contingência `tpEmis = 9` (8 campos) e v3 (`>= 3` campos) |
| Chave de acesso de 44 dígitos (fallback) | `2326 1003 5394 ...` | `qrcode_v3` | Remove caracteres não numéricos (`/\D/g`) e assume ambiente de produção (`'1'`) |

- **QR Code v2 Normal (5 campos):** `chave | 2 | ambiente | idCSC | hash`.
- **QR Code v2 Contingência (8 campos):** `chave | 2 | ambiente | diaEmissao | valorTotal | digVal | idCSC | hash`. O campo `digVal` (`parts[5]`) pode chegar vazio (`||`) em QR Codes reais de PDVs em contingência; quando todos os demais campos obrigatórios (`diaEmissao`, `valorTotal`, `idCSC`, `hash`) e a chave de 44 dígitos são válidos, `FiscalNoteInput` aceita a entrada normalizando `contingencyDigestValue` para `null` e preservando `channel: 'qrcode_v2'`, `qrVersion: '2'`, `sourceHost` e `unknownQrHost` fiéis ao QR Code original.
- **QR Code v3 (mínimo 3 campos):** `chave | 3 | ambiente`.

## Validação Local Obrigatória (Fail-Fast)

Antes de consultar cache Redis ou SEFAZ, `FiscalNoteInput.parse()` impõe as seguintes invariantes em ordem determinística:

1. **Ambiente de Produção:** No payload do QR Code, `ambiente === '2'` (homologação) é rejeitado com `422 FISCAL_NOTE_HOMOLOGATION_NOT_ALLOWED`; qualquer valor diferente de `'1'` falha com `400 FISCAL_NOTE_INVALID_INPUT`.
2. **Estrutura da Chave (44 dígitos):** A chave extraída deve conter exatamente 44 dígitos numéricos (`400 FISCAL_NOTE_INVALID_INPUT`).
3. **Modelo Fiscal NFC-e (`65`):** As posições `21–22` (1-indexed, `slice(20, 22)`) devem corresponder a `'65'`. Notas modelo `55` (NF-e) ou outros modelos são rejeitados com `400 FISCAL_NOTE_INVALID_INPUT`.
4. **Dígito Verificador Módulo 11:** O 44º dígito é validado sobre os 43 primeiros dígitos com pesos cíclicos `2..9` da direita para a esquerda (`resto = soma % 11`; `dv = resto === 0 || resto === 1 ? 0 : 11 - resto`). Divergência falha com `400 FISCAL_NOTE_INVALID_INPUT`.
5. **UF Suportada:** Os 2 primeiros dígitos (`uf = slice(0, 2)`) devem corresponder a uma UF registrada em `FiscalNoteSupportedUfs`. Na V1, apenas o Ceará (`'23'`) é suportado; outras UFs válidas falham com `422 FISCAL_NOTE_UNSUPPORTED_UF`.

## Proteção Anti-SSRF e Allowlist de Hosts

Mesmo quando o cliente envia uma URL completa de QR Code, o backend **jamais** requisita essa URL:

- O `FiscalNoteInput` extrai o `hostname` normalizado em minúsculas apenas para auditoria de origem (`sourceHost`).
- Compara `sourceHost` contra `FISCAL_NOTE_ALLOWED_HOSTS_BY_UF[uf]` (para `UF = '23'`, `SEFAZ_CE_ALLOWED_HOSTS = ['nfce.sefaz.ce.gov.br']`).
- Se o host estiver fora da allowlist, preenche `unknownQrHost` sem bloquear a leitura legítima do parâmetro `p`. O `FiscalNoteQueryService` registra um log `warn` (`FISCAL_NOTE_UNKNOWN_QR_HOST`) e dispara alerta operacional `WARN` via `OperationalAlertService`, mas a chamada externa continua sendo enviada exclusivamente para a base URL fixa configurada (`FISCAL_NOTES_SEFAZ_CE_BASE_URL`).
- O cliente HTTP da SEFAZ-CE configura `redirect: 'error'`, impedindo que redirecionamentos `30x` desviem a requisição para hosts internos ou terceiros.

## Estratégia Plugável Multi-UF

- **`IFiscalNoteProvider`:** Contrato abstrato expondo `readonly uf: string` e `fetchAndParse(input: FiscalNoteInput): Promise<ParsedFiscalNoteData>`.
- **`IFiscalNoteProviderRegistry` (`FiscalNoteProviderRegistry`):** Mapeia provedores injetados via token `FISCAL_NOTE_PROVIDERS_TOKEN` por código IBGE da UF.
- **Provedor V1 (`SefazCeProvider`, `UF = '23'`):** O `SefazCeHttpClient` encapsula o roteamento específico da SEFAZ-CE: envia para `POST /nfce/api/notasFiscal/qrcodev2/` quando o canal é `qrcode_v2` com `digVal` preenchido (ou não contingência), e faz fallback interno para `POST /nfce/api/notasFiscal/qrcodev3/` (`{ chave_acesso, versao_qrcode: '3', tipo_ambiente: '1' }`) quando o canal é `qrcode_v3` **ou** quando é contingência v2 com `contingencyDigestValue === null` (pois a SEFAZ-CE rejeita `dig_val` vazio no `/qrcodev2/`, mas aceita a consulta por chave no `/qrcodev3/`). Essa regra permanece isolada no cliente da SEFAZ-CE sem assumir suporte v3 por chave de 44 dígitos para futuros provedores de outras UFs.
