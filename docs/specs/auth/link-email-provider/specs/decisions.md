---
area: auth
feature: link-email-provider
type: spec-decisions
status: current
issue: https://github.com/danzSTK/personal-finance-backend/issues/79
related:
  - ./requirements.md
  - ./design.md
  - ./tasks.md
---

# Decisions - Link EMAIL Provider Ao E-mail Principal

## DEC-001 - users.email É A Identidade Canônica De E-mail

Status: accepted

Decision:
Uma conta possui um único e-mail principal em `users.email`. O provider `EMAIL`
representa credenciais locais para esse mesmo e-mail e não introduz endereço
alternativo.

Reason:
O login local já localiza a conta por `users.email`. Permitir outro
`provider_user_id` cria uma identidade que não funciona de forma coerente e
duplica a fonte de verdade.

Impact:
O vínculo sempre deriva `provider_user_id` do usuário persistido. Troca de e-mail
fica centralizada em feature futura.

## DEC-002 - O Request Funcional Contém Somente Senha

Status: accepted

Decision:
`password` é o único dado funcional informado pelo cliente. `userId` vem da
sessão e o e-mail vem de `users.email`.

Reason:
O cliente não é autoridade sobre identidade ou ownership durante o vínculo.

Impact:
O DTO de aplicação deixa de aceitar e-mail e o controller nunca o repassa.

## DEC-003 - Aceitar E Ignorar email Durante Uma Versão De Transição

Status: accepted

Decision:
O DTO HTTP continuará aceitando temporariamente a propriedade opcional `email`,
marcada como depreciada, mas ignorará seu valor integralmente. A próxima versão
coordenada com o frontend removerá a propriedade.

Reason:
Backend e frontend são implantados de forma coordenada como BFF, mas aceitar o
request anterior por uma versão reduz risco de acoplamento operacional sem
preservar a regra incorreta de e-mail alternativo.

Alternatives considered:

- Rejeitar imediatamente `email`: simples, mas transforma qualquer request antigo
  em `400` por `forbidNonWhitelisted`.
- Aceitar somente se igual ao principal: ainda dá significado funcional ao campo
  que deixou de ser fonte de verdade.

Impact:
Swagger e integração declaram depreciação e descarte. A remoção definitiva deve
ser rastreada para a próxima versão.

## DEC-004 - Serializar O Vínculo Pelo Lock Do Usuário

Status: accepted

Decision:
Carregar o usuário com `findByIdForUpdate()` dentro da transação e revalidar o
provider depois do lock. Manter `UQ_auth_providers` como proteção final.

Reason:
Uma leitura comum permite que duas requisições observem ausência de provider e
tentem inserir simultaneamente. O lock torna o resultado funcional previsível
para a mesma conta.

Impact:
A requisição perdedora retorna conflito estável. Unique violation conhecida é
traduzida e SQL bruto não chega ao cliente.

## DEC-005 - Não Alterar Schema Sem Evidência Da Auditoria

Status: accepted

Decision:
A mudança principal é de comportamento e contrato HTTP. Não criar migration de
schema. Primeiro contar registros históricos divergentes; somente evidência
positiva pode abrir uma decisão de correção de dados.

Reason:
O schema já possui `users.email NOT NULL`, unicidade do e-mail principal e
unicidade do provider. Uma migration sem dados que a justifiquem adicionaria
risco sem fortalecer a invariante entre tabelas.

Impact:
Se houver divergências, a spec será atualizada com rollout `expand -> migrate ->
contract`, matriz N/N+1 e estratégia idempotente antes de qualquer SQL mutável.

## DEC-006 - Preservar Google OAuth E Tratar Verificação Separadamente

Status: accepted

Decision:
A issue #79 não altera presença, seleção ou atributo `verified` do e-mail Google.
O comportamento atual fica preservado e a evolução foi rastreada na issue #90.

Reason:
A procedência do e-mail Google, os estados de perfil/verificação e o contrato do
callback formam uma feature independente do vínculo de senha ao e-mail já
persistido.

Impact:
Nenhum arquivo, status, evento, challenge ou teste de Google OAuth entra nesta
entrega.

## DEC-007 - Vínculo EMAIL Não Dispara Verificação

Status: accepted

Decision:
Adicionar o provider `EMAIL` reutiliza `users.email` e não cria challenge, e-mail
automático, evento de verificação ou transição de status.

Reason:
O vínculo de senha adiciona um método de autenticação; ele não altera nem valida
a procedência do endereço principal.

Impact:
Google-only e demais contas preservam status, perfil, sessões e providers
anteriores.

## DEC-008 - Proteções Adicionais Ao Adicionar Senha

Status: accepted

Decision:
Preservar a proteção atual do endpoint: access token válido, sem reautenticação
recente, revogação de sessões ou notificação adicional. Remover
`sessionMetadata` do caso de uso porque ele não é consumido.

Reason:
O escopo aprovado corrige a identidade do provider e reduz a superfície do
request. Endurecimento adicional pode ser tratado separadamente sem manter dado
morto no contrato interno.

Impact:
Não há alteração de sessões, eventos ou notifications nesta entrega.

## DEC-009 - Tratamento De Dados Históricos Divergentes

Status: accepted

Decision:
A auditoria sanitizada do PostgreSQL local em 2026-08-28 retornou `0` providers
`EMAIL` com `provider_user_id <> users.email`. A feature não cria migration nem
script de correção.

Reason:
O comportamento antigo permitia divergência, mas o ambiente auditado não contém
dados a migrar. O schema já oferece as constraints necessárias à mudança de
comportamento.

Impact:
Qualquer divergência encontrada em outro ambiente deve interromper o rollout e
abrir decisão/migração própria antes de alterar dados.
