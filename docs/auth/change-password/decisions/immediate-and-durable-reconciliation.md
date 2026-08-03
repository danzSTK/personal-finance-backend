---
area: auth
type: decision
status: current
related:
  - ../flow/success.md
  - ./full-projection-replacement.md
  - ./separated-outbox-events.md
---

# Reconciliação imediata e durável

## Decisão

O `finally` tenta reconstruir o Redis imediatamente e o evento
`auth.password-change.state-refresh-requested` repete o trabalho pela outbox.

## Motivos

- A via direta reduz o tempo até o estado operacional refletir o commit.
- A outbox cobre encerramento do processo, indisponibilidade do Redis e falha
  entre commit e `finally`.
- Ambos os caminhos podem reutilizar o mesmo sincronizador e `replace`.

## Consequências

- Quando tudo funciona, a projeção é reconstruída duas vezes.
- Esse custo adicional fornece recuperação durável e idempotente.
- Falha na sincronização imediata não desfaz o fato já confirmado.
