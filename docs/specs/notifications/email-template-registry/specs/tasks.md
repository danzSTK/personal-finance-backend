---
area: notifications
feature: email-template-registry
type: spec-tasks
status: current
related:
  - ./requirements.md
  - ./design.md
  - ./decisions.md
---

# Tasks - Email Template Registry

## Aprovação

- [x] 1. Revisar e aprovar `requirements.md`, `design.md` e esta ordem de
     implementação antes de alterar código.

## Contrato Lógico

- [x] 2. Remover IDs e nomes Brevo das constantes de domínio de notifications.
- [x] 3. Declarar chaves lógicas e referência versionada de template.
- [x] 4. Declarar o mapa TypeScript de parâmetros para
     `welcome-email:v1` e `email-verification:v1`.
- [x] 5. Criar schemas Zod estritos e o registro de contratos.
- [x] 6. Criar erros estáveis para chave, versão e parâmetros inválidos.
- [x] 7. Cobrir contratos e erros com testes unitários sem Nest TestingModule.

## Persistência

- [x] 8. Ler novamente `docs/database/schema.md` e as migrations de
     `email_messages` antes de criar a migration.
- [x] 9. Atualizar a entidade de domínio com `templateVersion` e provider como
     resultado nullable.
- [x] 10. Atualizar ORM entity e mapper para o modelo final.
- [x] 11. Criar migration transacional com backfill `v1`, constraint positiva,
      provider nullable e remoção de `provider_template_id`.
- [x] 12. Fazer a migration abortar diante de chaves desconhecidas ou mensagens
      reenfileiráveis.
- [x] 13. Criar testes de infraestrutura para backfill e preservação dos dados.

## Criação Das Intenções

- [x] 14. Alterar os casos de uso de welcome e verificação para escolher chave e
      versão sem provider ou ID externo.
- [x] 15. Validar os parâmetros antes de persistir cada intenção.
- [x] 16. Atualizar testes de use case, handlers e idempotência.

## Envio E Provider

- [x] 17. Alterar o contrato público de mail para receber referência lógica em
      vez de `templateId`.
- [x] 18. Criar o resolver Brevo por chave e versão no limite da infraestrutura.
- [x] 19. Mover os mappings para `mail.config` e adicionar as variáveis Brevo
      versionadas ao Joi e aos exemplos de ambiente.
- [x] 20. Remover
      `NOTIFICATIONS_EMAIL_VERIFICATION_PROVIDER_TEMPLATE_ID` do config e dos
      ambientes.
- [x] 21. Revalidar `templateParams` no `SendEmailMessageUseCase`.
- [x] 22. Marcar erros de contrato ou mapping como `FAILED_PERMANENT` sem chamar
      o SDK.
- [x] 23. Registrar provider somente após o resultado operacional apropriado.
- [x] 24. Preservar classificação e retry das falhas externas já existentes.
- [x] 25. Garantir que `NoopMailProvider` funcione sem mappings Brevo.
- [x] 26. Atualizar testes de MailService, Brevo adapter, noop, worker e
      reconciliação.

## Templates Canônicos

- [x] 27. Criar a estrutura versionada em `api/email-templates/`.
- [x] 28. Transferir `danfy-welcome-email.html` para `welcome-email/v1`.
- [x] 29. Transferir `danfy-email-verification.html` para
      `email-verification/v1`.
- [x] 30. Validar que os placeholders transferidos correspondem exatamente aos
      contratos aprovados.
- [x] 31. Criar o comando determinístico de validação dos templates.
- [x] 32. Integrar o comando ao package script e à CI apropriada.
- [x] 33. Remover as cópias de HTML do repositório frontend somente após a fonte
      backend estar publicada e validada.

## Skill De Construção

- [x] 34. Inicializar `.agents/skills/email-template-constructor` com a
      ferramenta oficial de `skill-creator`.
- [x] 35. Criar instruções de baixa liberdade para design, versionamento,
      contratos e segurança.
- [x] 36. Criar referência do design system Danfy sem duplicar o catálogo.
- [x] 37. Fazer a skill executar o validador determinístico antes de concluir.
- [x] 38. Gerar `agents/openai.yaml` e validar a skill com `quick_validate.py`.
- [x] 39. Exercitar a skill na revisão dos templates migrados e não manter
      artefatos descartáveis.

## Documentação

- [x] 40. Atualizar o índice de notifications e criar a documentação precisa do
      modelo de template.
- [x] 41. Documentar design system, versionamento, publicação manual e
      aposentadoria de mappings.
- [x] 42. Atualizar as páginas de `welcome-email` e `email-verification` com
      versão, contrato, origem, HTML e variável de mapping sem valor numérico.
- [x] 43. Atualizar `docs/platform/email-provider.md` e
      `api/src/shared/mail/README.md`.
- [x] 44. Atualizar `docs/configuration.md`, `.env.exemple` e arquivos Compose
      aplicáveis.
- [x] 45. Atualizar `docs/auth/change-password/notifications.md` para remover a
      exigência de persistir IDs externos.
- [x] 46. Atualizar as specs vivas de welcome, email verification e email
      provider, registrando a substituição da decisão antiga.
- [x] 47. Documentar com precisão o risco atual do token dentro de
      `verification_url` e registrar que a decisão/spec de segurança será um
      estudo separado antes da produção.

## Limpeza Do Contrato Legado

- [x] 48. Confirmar ausência de mensagens reenfileiráveis antes de executar a
      migration.
- [x] 49. Atualizar `docs/database/schema.md` no mesmo commit da migration.
- [x] 50. Remover propriedades, limites, mappers e testes legados relacionados
      ao ID persistido.

## Validação Final

- [x] 51. Executar testes de domínio e aplicação de notifications.
- [x] 52. Executar testes de infraestrutura e integração API/worker.
- [x] 53. Executar typecheck, lint, formatação e validação dos HTMLs.
- [x] 54. Executar a migration direta em banco descartável, incluindo rollback.
- [x] 55. Validar links e ausência de IDs Brevo fora da configuração e do adapter.
- [x] 56. Validar que o frontend não mantém cópia dos templates migrados.
- [x] 57. Revisar observabilidade sem exposição de params, HTML ou tokens.
