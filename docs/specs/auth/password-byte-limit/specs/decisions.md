# Decisões — limite UTF-8 de senhas locais

## DEC-001 — Limites de caracteres e bytes coexistem

Status: aceita

Decisão: manter o máximo de 50 caracteres e adicionar o máximo inclusivo de 72
bytes UTF-8.

Motivo: caracteres controlam o contrato de produto; bytes controlam a entrada
efetiva aceita pelo bcrypt.

## DEC-002 — Utilitário puro é a única fonte do cálculo

Status: aceita

Decisão: calcular o limite com `Buffer.byteLength(value, 'utf8')` em uma função
booleana compartilhada por DTOs e serviço de hash.

Motivo: evita cálculos repetidos e reduz a chance de um fluxo futuro esquecer a
regra.

## DEC-003 — DTO antecipa; serviço garante

Status: aceita

Decisão: validar na borda com decorator e novamente dentro de `hash()` e
`compare()`.

Motivo: o decorator oferece erro de campo, mas não protege consumidores internos,
scripts ou futuros adapters. O serviço é a última fronteira antes do bcrypt.

## DEC-004 — Nunca truncar nem normalizar

Status: aceita

Decisão: rejeitar a entrada original quando ela ultrapassar o limite.

Motivo: cortar ou normalizar muda o segredo escolhido e pode produzir
equivalências inesperadas.

## DEC-005 — Login preserva credenciais inválidas genéricas

Status: aceita

Decisão: `compare()` lança o erro específico internamente, mas a
`LocalStrategy` converte somente esse erro para a mesma resposta `401` usada por
credenciais inválidas.

Motivo: guards executam antes dos pipes, então o `LoginEmailDto` não é uma
barreira real. A proteção central evita truncamento e a tradução não cria um
contrato de autenticação distinguível.

## DEC-006 — Sem tratamento legado

Status: aceita

Decisão: aplicar a proteção imediatamente em hash e compare, sem modo de
compatibilidade ou rehash.

Motivo: não existem credenciais atuais conhecidas acima de 72 bytes.
