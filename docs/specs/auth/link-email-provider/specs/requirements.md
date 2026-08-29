---
area: auth
feature: link-email-provider
type: spec-requirements
status: current
issue: https://github.com/danzSTK/personal-finance-backend/issues/79
related:
  - ../../../../auth/flows/link-email-provider.md
  - ../../../../auth/concepts/auth-provider.md
  - ../../../../auth/decisions/no-automatic-provider-link.md
  - ../../../../integrations/auth/link-providers.md
  - ../../../../integrations/auth/passwords.md
  - ../../../../database/schema.md
---

# Requirements - Link EMAIL Provider Ao E-mail Principal

## Estado De Aprovação

Spec aprovada pelo responsável pelo produto em 2026-08-28, com implementação
autorizada. A verificação da procedência do e-mail Google foi separada na issue
[#90](https://github.com/danzSTK/personal-finance-backend/issues/90) e não
bloqueia esta entrega.

## Objetivo

Permitir que um usuário autenticado adicione uma senha à própria conta e passe a
autenticar também pelo provider `EMAIL`, usando obrigatoriamente o e-mail
principal persistido em `users.email`.

O vínculo não representa troca de e-mail, não cria uma segunda identidade de
e-mail e não pode usar um endereço escolhido pelo cliente.

## Contexto

Um usuário pode possuir múltiplos métodos de autenticação em `auth_providers`,
mas possui um único e-mail principal em `users.email`.

O endpoint atual `POST /auth/providers/link/email` recebe `email` e `password` e
persiste o e-mail recebido como `auth_providers.provider_user_id`. Ao mesmo
tempo, o login local primeiro procura a conta por `users.email` e somente depois
obtém o provider `EMAIL`. Isso permite criar estado divergente no qual o e-mail
informado no vínculo não é o e-mail que localiza a conta no login.

Esta mudança resolve a issue
[#79](https://github.com/danzSTK/personal-finance-backend/issues/79) e evolui o
comportamento originalmente entregue pela issue #19.

## Fontes De Verdade

- `users.email` é `NOT NULL`, normalizado e único no schema atual.
- Para `EMAIL`, `auth_providers.provider_user_id` representa o e-mail usado pelo
  método de credenciais.
- `ValidateCredentialsUseCase` localiza a conta por `users.email`.
- A senha local segue o contrato central de 6 a 50 caracteres e no máximo 72
  bytes UTF-8.
- Identidade autenticada vem do JWT/cookie; o body nunca fornece `userId`.

## Terminologia

- **E-mail principal:** valor atual e normalizado de `users.email`.
- **Provider GOOGLE:** método OAuth identificado pelo `googleId` em
  `provider_user_id`.
- **Provider EMAIL:** método local composto pelo e-mail principal e pelo hash da
  senha.
- **Campo legado `email`:** propriedade temporariamente aceita no request por
  compatibilidade coordenada com o frontend, sem qualquer efeito funcional.

## Escopo

Esta spec cobre:

- derivar o identificador do provider `EMAIL` de `users.email` carregado da
  persistência;
- deixar de usar qualquer e-mail recebido no request para regras, consultas,
  persistência, logs ou resposta;
- tornar `email` opcional, ignorado e marcado como depreciado durante a versão de
  transição;
- manter `password` como o único dado funcional do body;
- preservar as regras centrais de validação e hash de senha;
- proteger o vínculo contra duplicidade e concorrência;
- garantir que o login local funcione com o e-mail principal após o vínculo;
- manter `users.email` inalterado;
- auditar a existência de providers `EMAIL` históricos divergentes do e-mail
  principal antes da implementação;
- atualizar documentação, Swagger e testes do fluxo.

## Fora De Escopo

- permitir e-mail alternativo no vínculo;
- alterar o e-mail principal;
- implementar o futuro fluxo de troca e confirmação de e-mail;
- desvincular providers;
- renomear o enum `EMAIL` para `CREDENTIALS`;
- remover fisicamente o campo legado `email` nesta versão;
- decidir ou executar correção de dados históricos antes da auditoria;
- criar novo schema ou migration sem evidência de necessidade;
- alterar a validação de presença ou procedência do e-mail Google, rastreada na
  issue #90;
- exigir reautenticação recente, revogar sessões ou enviar notificação de
  segurança ao adicionar senha;
- alterar status, challenge, outbox ou eventos de verificação de e-mail.

## Regras De Negócio Confirmadas

### Identidade E E-mail Canônico

- Toda conta possui `users.email` obrigatório.
- O provider `EMAIL` de uma conta deve usar exatamente o e-mail principal atual
  como `provider_user_id`.
- O e-mail do JWT não é fonte de verdade para o vínculo; o usuário deve ser
  recarregado da persistência pelo `userId` autenticado.
- Vincular `EMAIL` não altera `users.email`, nome, username, status, avatar ou
  providers já existentes.
- Uma futura troca de e-mail será centralizada em fluxo próprio e deverá manter
  o provider `EMAIL` coerente com a nova identidade.

### Request De Transição

- `password` é obrigatório e é o único campo funcional do body.
- `email` pode ser enviado temporariamente, é opcional e está depreciado.
- O valor legado de `email` deve ser ignorado integralmente, mesmo quando for
  diferente do e-mail principal.
- O controller não deve repassar o campo legado ao caso de uso.
- Outros campos extras continuam rejeitados pelo `ValidationPipe` global.
- A próxima versão coordenada com o frontend removerá o campo legado do DTO,
  Swagger e documentação.

### Vínculo

- O vínculo exige sessão autenticada.
- A senha deve respeitar as constantes e validações compartilhadas da plataforma.
- A senha em claro nunca pode ser persistida, retornada ou escrita em logs.
- Se a conta já possuir provider `EMAIL`, a operação falha com conflito e não
  funciona como troca ou recuperação de senha.
- Se o identificador canônico já estiver vinculado como provider `EMAIL` de
  outra conta, a operação falha com código estável e sem persistência parcial.
- Duas tentativas concorrentes para a mesma conta devem produzir no máximo um
  provider `EMAIL`.
- A constraint `UQ_auth_providers(provider, provider_user_id)` permanece como
  proteção final contra corrida, mas violações esperadas devem ser traduzidas
  para erro de aplicação estável.

### Login Local Depois Do Vínculo

- Após o vínculo, o usuário autentica localmente com `users.email` e a senha
  escolhida.
- Um valor divergente enviado no campo legado não se torna identificador de
  login.
- A resposta de perfil continua expondo os providers vinculados sem expor
  `provider_user_id` ou `password_hash`.

### Comportamento Google Preservado

- Esta entrega não altera `GoogleStrategy`, `OAuthCallbackUseCase`, criação de
  conta Google ou estados de verificação.
- A análise e a futura decisão sobre `emails[].verified` pertencem à issue #90.
- Vincular `EMAIL` usa o e-mail principal já persistido e não cria challenge,
  e-mail automático ou evento de verificação.

## Fluxos

### Fluxo Principal De Vínculo

1. Frontend envia `password` e pode ainda enviar `email` depreciado.
2. JWT identifica o `userId`.
3. API valida somente a senha como entrada funcional.
4. Aplicação carrega e bloqueia o usuário persistido na transação.
5. Aplicação lê `user.email.value`.
6. Aplicação revalida duplicidade do provider `EMAIL`.
7. Aplicação adiciona `EMAIL` com o e-mail principal e o hash da senha.
8. Repository persiste o agregado e invalida o cache aplicável.
9. API responde sucesso sem expor credenciais.

## Requisitos Funcionais

### REQ-001 - Usar o e-mail principal

WHEN um usuário autenticado vincular o provider `EMAIL`
THE SYSTEM SHALL usar o valor de `users.email` carregado da persistência como
`provider_user_id`.

### REQ-002 - Ignorar o e-mail legado

WHEN o request incluir o campo depreciado `email`
THE SYSTEM SHALL aceitar a propriedade durante a versão de transição e ignorar
seu valor integralmente.

### REQ-003 - Permitir request sem e-mail

WHEN o request contiver somente uma senha válida
THE SYSTEM SHALL executar o mesmo vínculo sem exigir `email` no body.

### REQ-004 - Não alterar o e-mail principal

WHEN o vínculo concluir
THE SYSTEM SHALL manter `users.email` inalterado.

### REQ-005 - Permitir login local coerente

WHEN o vínculo concluir com sucesso
THE SYSTEM SHALL permitir autenticação local usando o e-mail principal e a senha
cadastrada.

### REQ-006 - Não transformar e-mail legado em login

WHEN o request incluir `email` diferente do e-mail principal
THE SYSTEM SHALL não persistir, consultar ou aceitar esse valor como login.

### REQ-007 - Rejeitar provider existente

IF o usuário já possuir provider `EMAIL`
THEN o vínculo deve falhar com `409 AUTH_PROVIDER_ALREADY_LINKED` sem alterar a
senha existente.

### REQ-008 - Rejeitar conflito entre contas

IF o e-mail principal estiver vinculado como provider `EMAIL` de outra conta
THEN o vínculo deve falhar com conflito estável sem reassociar o provider.

### REQ-009 - Serializar tentativas concorrentes

WHEN duas requisições disputarem o vínculo para a mesma conta
THE SYSTEM SHALL persistir no máximo um provider `EMAIL` e traduzir a perdedora
para um resultado funcional estável.

### REQ-010 - Preservar a política de senha

WHEN a senha estiver fora dos limites de caracteres ou bytes UTF-8
THE SYSTEM SHALL retornar `400 VALIDATION_ERROR` sem chamar bcrypt com entrada
fora do limite.

### REQ-011 - Preservar o fluxo Google

WHEN esta feature for entregue
THE SYSTEM SHALL não alterar a validação, criação de usuário, status ou eventos
do login Google.

### REQ-012 - Não disparar verificação ao vincular

WHEN o provider `EMAIL` for vinculado
THE SYSTEM SHALL não criar challenge, e-mail automático, outbox ou transição de
status de verificação.

### REQ-013 - Não criar schema sem necessidade

WHEN a auditoria não encontrar divergências históricas que exijam correção
THE SYSTEM SHALL implementar a mudança sem migration de schema ou dados.

### REQ-014 - Expor resposta identificada

WHEN o vínculo concluir com sucesso
THE SYSTEM SHALL retornar response DTO sem dados sensíveis e com discriminador
`object` centralizado para a forma de vínculo de provider.

## Edge Cases

- Request contém `email` válido, inválido, vazio, nulo ou diferente: o campo é
  legado e não influencia o vínculo.
- Request contém campo extra diferente de `email`: validação global rejeita.
- Usuário autenticado deixou de existir: operação falha sem persistência.
- Usuário já possui `EMAIL`: senha atual não é substituída.
- Cache contém versão anterior do usuário: consulta transacional deve usar a
  persistência autoritativa e a escrita deve invalidar cache.
- Hash é calculado, mas a transação falha: nenhum provider parcial é persistido.
- Constraint unique perde uma corrida: erro SQL não pode escapar para o cliente.

## Expectativas Para O Frontend

- O frontend novo envia somente `password`.
- Durante a transição, frontend antigo pode continuar enviando `email`; o backend
  ignora o valor.
- O frontend não deve interpretar a aceitação temporária como suporte a e-mail
  alternativo.
- A remoção física do campo será coordenada em versão posterior.
- O frontend usa `GET /users/me` e `providers` para refletir que `EMAIL` foi
  vinculado.
- O frontend reage a códigos estáveis, nunca a mensagens internas.

## Critérios De Aceitação

- [x] `requirements.md`, `design.md` e `tasks.md` foram aprovados explicitamente
      antes da implementação.
- [x] Usuário Google-only vincula `EMAIL` enviando somente senha.
- [x] O novo provider usa exatamente o `users.email` persistido.
- [x] Campo legado `email` é aceito, marcado como depreciado e ignorado.
- [x] Valor alternativo enviado no campo legado não aparece no banco, logs ou
      resposta e não funciona como login.
- [x] Login local com e-mail principal e nova senha funciona após o vínculo.
- [x] `users.email`, status, perfil e provider GOOGLE permanecem inalterados.
- [x] Conta com provider `EMAIL` recebe conflito sem trocar senha.
- [x] Conflito entre contas e corrida de unicidade retornam erro estável.
- [x] Duas requisições concorrentes criam no máximo um provider.
- [x] Limites de senha são preservados e segredos não são expostos.
- [x] Login Google, status e eventos permanecem sem alteração nesta entrega.
- [x] O vínculo não dispara verificação de e-mail, alteração de sessão ou
      notificação.
- [x] Swagger e integração documentam `email` como legado ignorado.
- [x] Response DTO declara `object` centralizado e não expõe dados sensíveis.
- [x] Auditoria de dados históricos foi executada e sua decisão registrada.
- [x] Testes unitários, integração e E2E cobrem os cenários consequenciais.
