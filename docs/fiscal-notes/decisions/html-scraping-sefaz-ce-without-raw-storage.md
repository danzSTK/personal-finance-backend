---
area: fiscal-notes
type: decision
status: current
related:
  - ../concepts/fiscal-note-aggregate.md
  - ../concepts/input-and-provider-strategy.md
  - ../flows/preview-and-resilience.md
---

# HTML Scraping da SEFAZ-CE com `cheerio/slim` e Sem Armazenamento Bruto

## Decisão

- Consultar exclusivamente os endpoints internos observados da SEFAZ-CE (`POST /nfce/api/notasFiscal/qrcodev2/` e `qrcodev3/`) sob `FISCAL_NOTES_SEFAZ_CE_BASE_URL` (padrão `http://nfce.sefaz.ce.gov.br`), isolando o uso de `http://` exclusivamente dentro de `SefazCeHttpClient`.
- Realizar o parsing do HTML retornado e a decodificação de entidades HTML malformadas no campo `erro` utilizando `cheerio/slim`.
- Descartar integralmente o bloco `Consumidor` antes da extração dos dados e **nunca** persistir o HTML/XML bruto no PostgreSQL, no Redis, no Object Storage (R2) ou em logs.
- Limitar o MVP exclusivamente à NFC-e (modelo `65`), rejeitando chaves de NF-e (modelo `55`) na validação local.

## Motivos

1. **Conformidade LGPD e Minimização de Dados (Zero-PII):** O HTML retornado pela SEFAZ-CE inclui a seção colapsável `Consumidor` com CPF/CNPJ e nome do comprador. Armazenar o HTML bruto ou extrair esses campos ampliaria desnecessariamente o risco de exposição de dados pessoais (PII) em backups, cache e logs, sem qualquer benefício para o controle financeiro pessoal.
2. **Aderência do `cheerio/slim` a HTML Real e Malformado:** Na integração real com a SEFAZ-CE, ocorrem entidades HTML sem ponto e vírgula (ex.: `"100 - QR Code Inv&aacutelido"`), atributos `id="linhaTotal"` duplicados e textos concatenados na emissão. `cheerio/slim` usa `parse5` aderente ao padrão WHATWG HTML5, não executa JavaScript (mitigando riscos de XSS/code execution) e não exige binários nativos.
   - *Alternativa descartada — Regex pura:* extremamente frágil a variações de formatação, quebras de linha e `&nbsp;`.
   - *Alternativa descartada — `node-html-parser`:* menor conformidade HTML5 para entidades malformadas.
   - *Alternativa descartada — `jsdom`:* consumo elevado de memória/CPU e execução desnecessária de ambiente DOM completo.
3. **Isolamento de Segurança para `http://`:** A API observada da SEFAZ-CE responde em `http://nfce.sefaz.ce.gov.br` (HTTPS não responde). Isolar a configuração `FISCAL_NOTES_SEFAZ_CE_BASE_URL` no cliente HTTP específico evita relaxar configurações globais de TLS do Node.js (como `NODE_TLS_REJECT_UNAUTHORIZED`) e mantém proteção anti-SSRF via allowlist e `redirect: 'error'`.
4. **Escopo Coeso do MVP (Sem NF-e Modelo 55):** A NF-e modelo `55` possui layout, portal e fluxo de consulta distintos dos da NFC-e modelo `65` (cupom de varejo por QR Code). Restringir `FISCAL_NOTE_MODEL_NFCE = '65'` no `FiscalNoteInput` garante comportamento determinístico e falha clara para entradas fora do escopo.

## Trade-offs e Riscos Aceitos

- **Acoplamento à Estrutura HTML da SEFAZ-CE:** Mudanças visuais ou estruturais no portal da SEFAZ-CE podem quebrar os seletores do `SefazCeHtmlParser`.
  - *Mitigação:* Versionamento explícito em `parser_version` (`sefaz-ce-html-v1`), validação rigorosa de integridade pós-parsing (chave extraída, CNPJ, itens e soma dentro de 1 centavo) e disparo automático de alerta `CRITICAL` (`FISCAL_NOTE_SEFAZ_PARSER_FAILURE`) + abertura de Circuit Breaker ao detectar falhas estruturais.
- **Impossibilidade de Reprocessamento Offline do HTML:** Por não guardar o HTML bruto, não é possível re-parsear notas antigas sem nova consulta à SEFAZ.
  - *Mitigação:* O trade-off é intencional para garantir Zero-PII e reduzir volume de armazenamento; `parser_version` identifica o contrato aplicado em cada registro.
