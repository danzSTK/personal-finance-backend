---
area: auth
type: decision
status: current
related:
  - ../redis-keys.md
  - ./full-projection-replacement.md
---

# `initialized` como marcador de completude

## Decisão

A store só retorna `READY` quando a chave `initialized` existe. O marcador é
gravado por último no `replace` e removido ao adquirir uma mutação.

## Motivos

- Ausência de uma métrica isolada pode significar zero ou perda parcial.
- Uma leitura não pode distinguir essas situações observando apenas as chaves
  de falhas, bloqueio e alterações.

## Consequências

- Sem `initialized`, o loader consulta o PostgreSQL e substitui a projeção.
- O marcador não autoriza a operação; ele declara que o snapshot está completo.
- Sua expiração periódica força uma nova reconstrução durável.
