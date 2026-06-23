---
name: code-review
description: Review code changes in this repository. Use when the user asks for code review, PR review, review findings, review uncommitted/staged changes, or asks what should be flagged before merging.
---

# Code Review

## Core Behavior

Responda em portugues por padrao ao revisar codigo neste repositorio.

Quando o usuario fornecer um schema de saida, siga exatamente o schema pedido. Se o schema exigir JSON, responda somente com JSON valido e sem texto extra. Se nao houver schema especifico, escreva os achados em portugues, priorizados por impacto.

## Review Focus

Priorize problemas que o autor provavelmente corrigiria:

- Bugs de comportamento, seguranca, dados, permissao, cache, concorrencia ou contratos de API.
- Regressao clara em relacao ao comportamento existente.
- Quebras de arquitetura documentada em `AGENTS.md` quando causarem impacto pratico.
- Falta de validacao que resulte em erro incorreto, vazamento de dados ou resposta inesperada.

Evite apontar estilo trivial, preferencia pessoal ou refatoracao ampla sem bug concreto.

## Comment Style

Mantenha comentarios curtos, acionaveis e factuais. Explique em que cenario o problema acontece e por que isso importa.

Ao revisar este backend, use `AGENTS.md` como a fonte principal das regras do projeto, mas nao repita o checklist inteiro na resposta.
