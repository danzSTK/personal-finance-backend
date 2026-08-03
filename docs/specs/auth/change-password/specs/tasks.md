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
