# Tarefas — alteração de senha autenticada

## 1. Contratos e domínio

- [x] Limpar código comentado e abstrações substituídas.
- [x] Finalizar constantes e limites de metadata.
- [x] Finalizar entidade e invariantes de `PasswordChangeEvent`.
- [x] Finalizar `ChangePasswordPolicy`.
- [x] Adicionar comportamento de troca de hash no provider de credenciais.
- [x] Adicionar `credentialVersion` ao usuário.
- [x] Criar os quatro eventos de domínio/outbox.
- [x] Criar todos os erros da feature.

## 2. Testes de domínio

- [x] Cobrir criação, reconstituição e invariantes de evento.
- [x] Cobrir bloqueio de 1 hora e reincidente de 24 horas.
- [x] Cobrir limites exatos e fronteiras das janelas.
- [x] Cobrir cooldown, limite diário e escolha do maior `retryAfter`.
- [x] Cobrir mudança do hash e incremento da versão.

## 3. Persistência PostgreSQL

- [x] Finalizar ORM entity, mapper e repository de eventos.
- [x] Adicionar leitura sem cache de `credentialVersion`.
- [x] Adicionar coluna à ORM entity, domínio, mapper e cache do usuário.
- [x] Criar migration de `credential_version`.
- [x] Revisar a migration de `password_change_events`.
- [x] Atualizar `docs/database/schema.md`.

## 4. Estado Redis

- [x] Finalizar port do state store.
- [x] Finalizar assembler, loader e synchronizer.
- [x] Finalizar scripts Lua de load, begin e replace.
- [x] Retornar PTTL ao perder a barreira.
- [x] Usar hash tags nas chaves por usuário.
- [x] Remover o block cache legado.
- [x] Alterar Redis operacional para `noeviction`.
- [x] Atualizar referência de chaves Redis.

## 5. Testes de aplicação e Redis

- [x] Testar assembler e reconstrução das janelas.
- [x] Testar loader para READY, MISSING, PENDING e indisponibilidade.
- [x] Testar synchronizer.
- [x] Testar adapter Redis e parsing de todos os resultados Lua.
- [x] Testar aquisição concorrente, owner token, TTLs e replace atômico com
      Redis real em integração.

## 6. Caso de uso

- [x] Implementar DTO de entrada com contexto sanitizado.
- [x] Implementar orquestração, transaction lock e resultados internos.
- [x] Persistir falha e bloqueio sem rollback acidental.
- [x] Persistir sucesso, versão e outbox na mesma transação.
- [x] Sincronizar estado após commit/rollback.
- [x] Tentar revogação física após sucesso.
- [x] Garantir ausência de dados sensíveis nos eventos e logs.

## 7. Testes do caso de uso

- [x] Sucesso completo.
- [x] Usuário/provider ausente.
- [x] Senha atual inválida antes e na quinta falha.
- [x] Senha nova igual.
- [x] Bloqueio, cooldown e limite diário antes de bcrypt.
- [x] Barreiras concorrentes.
- [x] Rollback nas falhas anteriores ao commit.
- [x] Commit preservado quando sincronização ou limpeza física falha.
- [x] Outbox e eventos corretos, idempotentes e sem dados sensíveis.

## 8. Tokens e sessões

- [x] Incluir versão na geração de access e refresh token.
- [x] Validar versão sem cache nas duas strategies.
- [x] Manter compatibilidade com tokens antigos na versão inicial.
- [x] Criar módulo reutilizável da persistência de sessões para API e worker.
- [x] Criar handler idempotente de revogação física.
- [x] Criar rehydrator e registrar o evento no worker.
- [x] Atualizar testes de geração, access, refresh e revogação.

## 9. Eventos e worker

- [x] Criar rehydrators dos eventos de password change.
- [x] Registrar rehydrators no `OutboxRehydratorsModule`.
- [x] Criar handler de reconciliação Redis.
- [x] Registrar handlers no `AuthEventHandlersModule`.
- [x] Cobrir rehydrators, deduplicação e handlers.
- [x] Atualizar documentação do mapa de eventos.

## 10. API e erros

- [x] Criar request e response DTOs.
- [x] Finalizar guard técnico com HMAC, Lua e logger correto.
- [x] Validar segredo HMAC na configuração.
- [x] Finalizar rota fina e limpeza de cookies.
- [x] Mapear erros e `Retry-After` no filtro global.
- [x] Expor `Retry-After` no CORS.
- [x] Refatorar metadata de sessão para o resolvedor de IP confiável.
- [x] Documentar a rota no Swagger.

## 11. Testes HTTP e segurança

- [x] Testar DTO e guard técnico.
- [x] Testar filtro global e header `Retry-After`.
- [x] E2E do contrato de sucesso, cookies, códigos de erro e `retryAfter`.
- [x] Testar nas duas strategies JWT antigo e versões revogadas.
- [x] Testar conta OAuth-only no use case e validação do body no HTTP.
- [x] Verificar que respostas/logs/eventos não contêm segredos.

## 12. Validação final

- [x] Executar Prettier.
- [x] Executar testes unitários da feature.
- [x] Executar testes de integração relevantes.
- [x] Executar testes E2E relevantes.
- [x] Executar `lint:check`, `typecheck` e `build`.
- [x] Revisar DI da API e do worker.
- [x] Revisar SQL, índices, constraints e rollback das migrations.
- [x] Revisar segurança de proxy, cookies, CORS, HMAC e dados sensíveis.

## 13. Catálogo e configuração das notificações

- [x] Declarar os tipos `PASSWORD_CHANGED` e `PASSWORD_CHANGE_BLOCKED`.
- [x] Declarar `password-changed:v1` e `password-change-blocked:v1` com parâmetros
      TypeScript e schemas Zod estritos.
- [x] Adicionar chaves de idempotência baseadas no evento fonte.
- [x] Adicionar mappings Brevo e validação condicional das variáveis de ambiente.
- [x] Atualizar os testes do catálogo, da configuração de mail e do bootstrap do
      worker.

## 14. Intenções e handlers de e-mail

- [x] Criar os DTOs e casos de uso idempotentes das duas intenções.
- [x] Criar o erro de usuário ausente no fluxo de notificação.
- [x] Criar e registrar os dois handlers no worker.
- [x] Corrigir o listener de senha alterada para usar o `eventName` canônico.
- [x] Remover código/comentário temporário sem função no processor.
- [x] Cobrir os dois casos de uso, inclusive concorrência, fallback de contexto e
      estados terminais.
- [x] Cobrir os dois handlers, inclusive o não reenfileiramento.

## 15. Documentação

- [x] Documentar o fluxo completo entre outbox, intenção, fila, worker e provider.
- [x] Documentar as duas chaves de template, parâmetros, origem, idempotência e
      cuidados de segurança.
- [x] Atualizar o índice de templates, configuração e provider de e-mail.
- [x] Validar os exemplos e caminhos documentados contra o código.

## 16. Templates HTML — executar por último

- [x] Definir com o responsável pelo produto o conteúdo textual de
      `password-changed:v1`.
- [x] Definir com o responsável pelo produto o conteúdo textual de
      `password-change-blocked:v1`.
- [x] Criar `api/email-templates/password-changed/v1/template.html` seguindo o
      design system oficial.
- [x] Criar `api/email-templates/password-change-blocked/v1/template.html`
      seguindo o design system oficial.
- [x] Executar `npm run email-templates:validate` e os testes do registro e do
      validador de fontes.
- [x] Executar `lint:check`, `typecheck`, testes e build finais.

## 17. Revisão dos templates antes da ativação

- [x] Formatar `changed_at` e `blocked_until` em horário de Brasília sem depender
      do timezone do processo.
- [x] Ajustar contratos, testes, HTML e documentação para os valores formatados.
- [x] Adicionar preheaders explícitos de até 35 caracteres nos dois templates.
- [x] Impedir que o worker sobrescreva o remetente do template hospedado.
- [x] Atualizar as versões v1 inativas na Brevo com `security@danfy.app`.
- [x] Conferir manualmente os dois previews renderizados no painel da Brevo e
      ativar as versões após aprovação.
- [x] Executar validação dos templates, testes, lint, typecheck e build.
- [x] Publicar o contrato de integração frontend do endpoint e seus erros.

## 18. Evidência integrada da credencial

- [x] Criar uma suíte própria com PostgreSQL e Redis reais para executar o caso de
      uso completo.
- [x] Comprovar persistência do hash e autenticação exclusiva pela nova senha.
- [x] Comprovar incremento de `credentialVersion`, auditoria, outbox e projeção.
- [x] Comprovar remoção de sessões e rejeição das versões antigas pelas duas
      strategies JWT.
- [x] Executar a suíte no comando agregado `npm run test:integration`.
