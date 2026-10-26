# Decision Template

Use este modelo para registrar qualquer decisão de arquitetura, design ou regra de negócio dentro de `docs/<modulo>/decisions/`.

```markdown
---
area: <modulo>
type: decision
status: current
related:
  - ../concepts/<conceito-relacionado>.md
  - ../flows/<fluxo-relacionado>.md
---

# <Título da Decisão no Imperativo ou Afirmativo>

## Decisão

Descreva de forma clara e direta a escolha adotada.

Exemplo:
- Usar enfileiramento direto no BullMQ sem Outbox para otimização de imagens.
- Confirmar remoção física com status DELETED e deleted_at sem apagar imediatamente a linha.

## Motivos

Apresente os argumentos que sustentam a escolha, preferindo dados, invariantes e restrições reais:

1. **<Motivo 1 - ex: Desacoplamento / Performance / Custo>:** Explique por que a alternativa descartada era pior ou inviável.
2. **<Motivo 2 - ex: Resiliência>:** O que acontece sob falhas ou concorrência.
3. **<Motivo 3 - ex: Invariante de Domínio>:** Como a decisão protege a consistência dos dados.

## Trade-offs e Riscos Aceitos

- O que perdemos ou qual complexidade assumimos ao tomar essa decisão?
- Qual é o plano de mitigação para os riscos identificados?
```
