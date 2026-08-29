---
area: auth
feature: link-email-provider
type: spec-design
status: current
issue: https://github.com/danzSTK/personal-finance-backend/issues/79
related:
  - ./requirements.md
  - ./tasks.md
  - ./decisions.md
  - ../../../../database/schema.md
  - ../../../../database/migration-rollout.md
  - ../../../../architecture/compatibility.md
---

# Design - Link EMAIL Provider Ao E-mail Principal

## Estado

Design aprovado para implementação em 2026-08-28. A procedência do e-mail Google
foi separada na issue #90 e o fluxo OAuth permanece inalterado nesta entrega.

## Visão Geral

O desenho mantém `User` como aggregate root da identidade e trata `EMAIL` como
um método de autenticação para o e-mail canônico da conta.

```text
POST /auth/providers/link/email
  -> JWT resolve userId
  -> DTO valida password e admite email legado ignorado
  -> LinkEmailProviderUseCase
      -> hash da senha
      -> transação PostgreSQL
          -> lock pessimista de users por userId
          -> lê user.email
          -> revalida providers
          -> adiciona EMAIL(user.email, passwordHash)
          -> salva User
      -> cache do usuário é invalidado
  -> LinkEmailProviderResponseDto
```

## Camadas Afetadas

### Presentation

- `LinkEmailProviderDto` passa a ter:
  - `password`: obrigatório e validado pelas regras compartilhadas;
  - `email`: opcional, depreciado e sem validação semântica, mantido somente para
    que o `ValidationPipe` não o trate como campo não permitido.
- O campo legado pode usar `@Allow()` do `class-validator` e tipo TypeScript
  `unknown`, deixando explícito que nenhum valor é consumido.
- Swagger marca `email` como `deprecated: true`, opcional e ignorado.
- O controller repassa somente `userId` e `password` ao caso de uso.
- `sessionMetadata` é removido desse DTO de aplicação porque não participa do
  comportamento aprovado.
- A resposta deve usar DTO próprio com `object` centralizado, sem retornar e-mail,
  hash ou provider interno.

Request funcional:

```json
{
  "password": "<strong-password>"
}
```

Request legado aceito durante a transição:

```json
{
  "email": "valor-completamente-ignorado@example.com",
  "password": "<strong-password>"
}
```

Resposta proposta:

```json
{
  "object": "auth_provider.email_link",
  "message": "Email provider linked successfully"
}
```

O nome final do discriminador deve ser adicionado a
`response-object.constants.ts` e seguir a convenção aprovada da plataforma.

### Application

`LinkEmailProviderUseCaseDto` deve conter somente:

```ts
interface LinkEmailProviderUseCaseDto {
  userId: string;
  password: string;
}
```

Fluxo proposto:

1. Gerar o hash fora da transação para não manter lock PostgreSQL durante o custo
   do bcrypt.
2. Abrir transação.
3. Carregar o usuário com `findByIdForUpdate(userId, { manager })`.
4. Se não existir, lançar `UserNotFoundError`.
5. Se já possuir qualquer provider `EMAIL`, lançar
   `AuthProviderAlreadyLinkedError`.
6. Derivar `canonicalEmail = user.email.value`.
7. Consultar `findByAuthProvider(EMAIL, canonicalEmail, { manager })`.
8. Se pertencer a outro usuário, lançar
   `AuthProviderLinkedToAnotherUserError`.
9. Adicionar provider por `User.addAuthProvider()` com o e-mail canônico e
   `HashedPassword.createFromHash(passwordHash)`.
10. Persistir o aggregate com o mesmo `EntityManager`.

O lock do usuário serializa duas tentativas para a mesma conta. A unique
constraint continua protegendo disputas entre contas ou dados históricos.

### Domain

Não é necessário adicionar uma segunda propriedade de e-mail ao domínio.

`User.addAuthProvider()` permanece responsável por criar o provider através de
`AuthProviderFactory`. O caso de uso é responsável por garantir que o
`providerUserId` de `EMAIL` seja derivado de `user.email`.

Como reforço futuro, a assinatura do domínio pode ganhar uma operação específica
para credenciais que não aceite e-mail arbitrário. Essa alternativa só deve ser
introduzida se reduzir uso incorreto sem acoplar o domínio ao fluxo HTTP.

### Infrastructure

- `IUserRepository.findByIdForUpdate()` já fornece o lock necessário.
- `UQ_auth_providers(provider, provider_user_id)` permanece como barreira final.
- Violações de `UQ_auth_providers` esperadas devem ser reconhecidas pelos helpers
  de PostgreSQL e traduzidas para erro de aplicação.
- `CachedUserRepository.save()` deve continuar invalidando a representação do
  usuário após a escrita.
- Nenhum ORM entity deve escapar da infraestrutura.

## Concorrência E Atomicidade

### Mesma Conta

```text
request A -> lock user -> adiciona EMAIL -> commit
request B -> espera lock -> recarrega user -> encontra EMAIL -> 409 estável
```

### Contas Diferentes

`users.email` já é único, portanto duas contas corretas não compartilham e-mail
principal. Dados históricos podem, contudo, ter um provider `EMAIL` divergente
apontando para o e-mail principal de outra conta. A consulta explícita detecta o
caso antes da escrita, e a constraint unique protege a corrida residual.

### Tradução De Unique Violation

A operação de save deve capturar apenas a constraint conhecida
`UQ_auth_providers`. Outros erros de banco continuam desconhecidos, são logados
internamente e retornam o contrato genérico sem SQL bruto.

## Contrato De Erros

| Cenário                           | Código                                 | HTTP | Observação                           |
| --------------------------------- | -------------------------------------- | ---: | ------------------------------------ |
| Body/senha inválida               | `VALIDATION_ERROR`                     |  400 | Campo `password` em `details.fields` |
| Provider EMAIL já existe na conta | `AUTH_PROVIDER_ALREADY_LINKED`         |  409 | Não altera senha                     |
| Provider pertence a outra conta   | `AUTH_PROVIDER_LINKED_TO_ANOTHER_USER` |  409 | Reuso recomendado                    |
| Usuário autenticado não existe    | `USER_NOT_FOUND`                       |  404 | Sem persistência                     |

Controllers não traduzem erros de negócio. Application errors escapam para o
filtro global. Nenhuma mensagem deve conter senha, hash, token, cookie ou SQL.

## Google OAuth E Verificação De E-mail

Nenhum arquivo do fluxo Google ou de email verification será alterado. A issue
#90 concentra a análise de `emails[].verified`, estados pendentes, callback e
eventos. O vínculo `EMAIL` somente reutiliza `users.email` e não dispara o fluxo
automático de verificação.

## Dados Persistidos E Migrations

### Schema

Não há mudança de schema necessária para derivar o provider de `users.email`.

O schema atual já possui:

- `users.email NOT NULL`;
- índice unique em `users.email`;
- `auth_providers.provider_user_id NOT NULL`;
- unique `(provider, provider_user_id)`.

### Auditoria Histórica

Antes da implementação, executar consulta somente de contagem em ambiente
autorizado:

```sql
SELECT count(*) AS divergent_email_providers
FROM auth_providers ap
JOIN users u ON u.id = ap.user_id
WHERE ap.provider = 'EMAIL'
  AND ap.provider_user_id <> u.email;
```

Não colocar e-mails reais em PR, issue ou logs. Se a contagem for maior que zero,
registrar a decisão antes de qualquer correção.

### Classificação De Rollout

- Sem divergências: mudança somente de código/contrato HTTP, sem migration.
- Com divergências: possível fase `migrate` de dados, ainda não aprovada.
- Nenhum `contract` de schema é planejado por esta spec.

Se correção de dados for necessária, uma atualização desta spec deve definir
idempotência, conflitos, N/N+1, ordem de deploy, rollback e documentação de
compatibilidade antes de criar migration.

## Compatibilidade Backend/Frontend

API e frontend são implantados coordenadamente como BFF, mas a versão de
transição continuará aceitando `email` para reduzir risco operacional e permitir
adaptação explícita.

| Cliente                         | Backend de transição    | Resultado                 |
| ------------------------------- | ----------------------- | ------------------------- |
| antigo envia `email + password` | aceita e ignora `email` | vínculo usa `users.email` |
| novo envia somente `password`   | aceita                  | vínculo usa `users.email` |
| envia outros campos extras      | rejeita                 | `VALIDATION_ERROR`        |

A próxima versão remove a propriedade depreciada de DTO, Swagger e documentação
de integração. Essa remoção não exige compatibilidade pública, mas deve ser uma
tarefa rastreável e coordenada com o único frontend consumidor.

## Segurança

- Identity/tenant vem exclusivamente do JWT.
- O e-mail usado é relido sob lock, não confiado do token ou body.
- Hash usa `IHashService` e limites compartilhados.
- Segredos não entram em eventos, resposta ou logs.
- Esta entrega preserva a proteção atual do endpoint: access token válido, sem
  reautenticação recente, revogação de sessões ou notificação. Endurecimento
  adicional exige feature própria.

## Estratégia De Testes

### DTO/Presentation

- aceita somente `password`;
- aceita `email` legado com valores variados sem repassá-lo;
- rejeita campos extras diferentes do legado;
- preserva limites de senha, inclusive 72/73 bytes UTF-8;
- retorna response DTO com `object`.

### Use Case

- usa `user.email.value` ao consultar e adicionar provider;
- nunca recebe e-mail no input;
- salva domain entity com o mesmo transaction manager;
- rejeita provider já existente;
- rejeita conflito com outra conta;
- traduz unique violation conhecida;
- não altera e-mail/status/outros providers;
- usa `findByIdForUpdate`.

### Infrastructure/PostgreSQL

- duas requisições concorrentes para a mesma conta geram uma linha;
- `UQ_auth_providers` continua efetiva;
- cache é invalidado após vínculo;
- login real com e-mail principal e senha funciona após vínculo.

### E2E

- request somente com senha retorna o response DTO identificado;
- body legado com e-mail diferente é aceito sem chegar ao caso de uso;
- campos desconhecidos e senha acima de 72 bytes são rejeitados;
- conflitos seguem o contrato global.

O E2E deste projeto usa casos de uso mockados e comprova a borda HTTP. Vínculo,
persistência, providers preservados, login real e concorrência são comprovados na
suíte de integração PostgreSQL para não introduzir infraestrutura na categoria
E2E.

## Documentação Impactada Na Implementação

- `docs/auth/flows/link-email-provider.md`;
- `docs/auth/concepts/auth-provider.md`;
- `docs/integrations/auth/link-providers.md`;
- `docs/auth/reference/endpoints.md`;
- `docs/auth/reference/error-codes.md`;
- `docs/integrations/errors.md`, se houver código novo;
- Swagger do controller e DTOs;
