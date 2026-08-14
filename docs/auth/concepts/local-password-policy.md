---
area: auth
type: concept
status: current
related:
  - ../decisions/limit-local-passwords-by-utf8-bytes.md
  - ../../integrations/auth/passwords.md
  - ../../specs/auth/password-byte-limit/specs/design.md
---

# Política de senhas locais

Esta política vale para credenciais do provider `EMAIL` em cadastro, vínculo,
login e alteração de senha.

## Limites simultâneos

Uma senha local precisa satisfazer os dois limites:

- entre 6 e 50 caracteres;
- no máximo 72 bytes quando codificada em UTF-8.

Caracteres e bytes não são equivalentes. ASCII normalmente ocupa um byte por
caractere, `é` ocupa dois bytes em UTF-8 e `😀` ocupa quatro. Por isso uma senha
com menos de 50 caracteres ainda pode ultrapassar 72 bytes.

Exatamente 72 bytes são aceitos. A partir de 73 bytes a entrada é rejeitada. O
backend mede a string original com `Buffer.byteLength(password, 'utf8')`; não
normaliza Unicode, não corta a entrada e não altera o segredo escolhido.

## Defesa em profundidade

```text
request de criação/alteração
  -> class-validator: erro associado ao campo
  -> use case
  -> IHashService
  -> BcryptHashService: valida novamente
  -> bcryptjs somente quando <= 72 bytes

login
  -> LocalAuthGuard / LocalStrategy
  -> ValidateCredentialsUseCase
  -> BcryptHashService.compare: valida antes do bcryptjs
  -> excesso convertido para o mesmo 401 de credenciais inválidas
```

O decorator melhora o contrato HTTP, mas não é a invariante final. Scripts,
jobs e novos casos de uso também podem chamar o serviço de hash. Por isso
`BcryptHashService.hash()` e `compare()` repetem a validação antes de delegar ao
bcrypt.

## Responsabilidades no código

| Responsabilidade | Arquivo |
| --- | --- |
| Limite central de 72 bytes | `api/src/common/models/constants/user.constants.ts` |
| Cálculo UTF-8 puro | `api/src/common/utils/password-byte-length.util.ts` |
| Validação reutilizável de DTO | `api/src/common/decorators/is-password-within-utf8-byte-limit.decorator.ts` |
| Erro interno estável | `api/src/common/domain/errors/password-byte-limit-exceeded.error.ts` |
| Garantia antes do bcrypt | `api/src/common/bcrypt-hash.service.ts` |
| Tradução segura do login | `api/src/modules/auth/infrastructure/strategies/local.strategy.ts` |

## Contratos de erro

- Cadastro, vínculo de provider e alteração: `400 VALIDATION_ERROR`, com o campo
  correspondente em `details.fields`.
- Login: `401` genérico com `Invalid credentials`, independentemente de a senha
  estar errada ou ultrapassar o limite.
- Consumidor interno que chamar o serviço diretamente: erro
  `PASSWORD_BYTE_LIMIT_EXCEEDED` antes de qualquer chamada ao bcrypt.

O erro e os logs não devem incluir a senha, prefixos, hash ou o tamanho concreto
da entrada recebida.
