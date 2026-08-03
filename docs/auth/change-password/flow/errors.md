---
area: auth
type: reference
status: current
related:
  - ./README.md
  - ../../reference/error-codes.md
  - ../decisions/pure-policy-longest-retry.md
---

# Erros e restrições

## Restrições avaliadas antes do bcrypt

A policy avalia todas as restrições ativas. Se houver mais de uma, devolve a
que possui o `retryAt` mais distante para que o cliente não tente novamente
antes da liberação real.

| Restrição           | Regra                                          | Resposta                                   |
| ------------------- | ---------------------------------------------- | ------------------------------------------ |
| Bloqueio por falhas | `blockedUntil > now`                           | `429 PASSWORD_CHANGE_BLOCKED`              |
| Cooldown            | menos de 10 minutos desde a última alteração   | `429 PASSWORD_CHANGE_COOLDOWN_ACTIVE`      |
| Limite diário       | 3 alterações na janela móvel de 24 horas       | `429 PASSWORD_CHANGE_DAILY_LIMIT_EXCEEDED` |
| Mutação concorrente | chave `pending` já existe                      | `409 PASSWORD_CHANGE_OPERATION_PENDING`    |
| Estado indisponível | Redis não permite validar/reconstruir o estado | `503 PASSWORD_CHANGE_STATE_UNAVAILABLE`    |
| Limite técnico      | IP ou JTI ultrapassa o limite de custo         | `429 PASSWORD_CHANGE_COST_LIMITED`         |

Erros temporários incluem `Retry-After` em segundos no header e no contrato de
erro da plataforma.

## Erros do processamento

| Situação                                | Código                                    | Status | Persiste falha?            |
| --------------------------------------- | ----------------------------------------- | ------ | -------------------------- |
| Usuário deixou de existir               | `USER_NOT_FOUND`                          | `404`  | Não                        |
| Conta não possui provider `EMAIL`       | `PASSWORD_CHANGE_EMAIL_PROVIDER_REQUIRED` | `409`  | Não                        |
| Nova senha igual à atual                | `NEW_PASSWORD_MUST_DIFFER`                | `400`  | Não                        |
| Nova senha viola a validação de entrada | erro de validação                         | `400`  | Não                        |
| Senha atual incorreta sem novo bloqueio | `CURRENT_PASSWORD_INVALID`                | `403`  | Sim                        |
| Quinta falha inicia bloqueio            | `PASSWORD_CHANGE_BLOCKED`                 | `429`  | Sim, e persiste o bloqueio |

## Recuperação de falhas

- Crash antes do commit: PostgreSQL e outbox sofrem rollback; `pending` expira
  e a ausência de `initialized` força hidratação.
- Crash depois do commit: a outbox mantém o pedido de reconciliação.
- Falha no replace imediato: o fato permanece correto no PostgreSQL e o worker
  tenta reconstruir o Redis.
- Falha na remoção de sessões: `credentialVersion` já revogou os tokens e o
  worker repete a limpeza física.
