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

## DEC-006 - Tratar E-mail Google Ausente E Não Verificado

Status: pending

Confirmed portion:
Se nenhum e-mail utilizável estiver presente, o sistema falha antes de
`OAuthCallbackUseCase`; nenhum usuário, provider, sessão, cookie ou evento é
criado.

Pending decision:
Quando existir e-mail, mas `verified !== true`, escolher uma alternativa:

1. rejeitar login/criação e redirecionar o frontend com erro estável; ou
2. criar usuário `PENDING_EMAIL_VERIFICATION` e reutilizar o fluxo Danfy.

Trade-off:
A alternativa 1 preserva o modelo atual e confia somente em identidade confirmada
pelo provider. A alternativa 2 permite continuar o onboarding, mas o status único
não representa simultaneamente `PENDING_PROFILE` e
`PENDING_EMAIL_VERIFICATION`; a confirmação atual leva diretamente a `ACTIVE`.

Required follow-up:
Definir código/redirect do callback. Se a alternativa 2 for escolhida, aprovar
uma máquina de estados que não pule a pendência de perfil e atualizar a spec de
email verification, hoje explicitamente restrita ao cadastro por credenciais.

## DEC-007 - Confiar No E-mail Confirmado Pelo Google

Status: accepted

Decision:
Quando o Google fornece e-mail com `verified = true`, usar o endereço normalizado
como `users.email` e não exigir uma segunda verificação Danfy somente porque o
usuário adicionou uma senha.

Reason:
O vínculo de senha adiciona método de autenticação, não altera o endereço nem sua
procedência.

Impact:
O provider `EMAIL` usa o e-mail principal já confirmado e o vínculo não cria
challenge ou evento de verificação.

## DEC-008 - Proteções Adicionais Ao Adicionar Senha

Status: pending

Pending decision:
Definir se o vínculo exige reautenticação recente com Google, preserva/revoga
sessões e envia notificação de segurança sobre o novo método de login.

Reason:
Uma senha cria acesso permanente adicional. O endpoint atual exige apenas access
token válido e recebe `sessionMetadata` sem utilizá-lo.

Impact:
A decisão pode alterar request/fluxo, eventos, notifications e testes. Deve ser
resolvida antes do código se fizer parte da issue #79.

## DEC-009 - Tratamento De Dados Históricos Divergentes

Status: pending-audit

Decision needed:
Após obter apenas a contagem sanitizada de divergências, escolher entre:

- nenhuma ação, se a contagem for zero;
- correção automática para `users.email` quando não houver conflito;
- bloqueio e resolução explícita quando houver colisão;
- operação manual auditada, se o volume e o risco não justificarem migration.

Reason:
O comportamento antigo permitia `provider_user_id <> users.email`. Reescrever
sem conhecer conflitos pode trocar inadvertidamente uma credencial de identidade.

Impact:
Nenhuma correção será implementada antes da auditoria e da atualização desta
decisão.
