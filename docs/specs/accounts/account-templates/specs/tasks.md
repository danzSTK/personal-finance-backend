---
area: accounts
feature: account-templates
type: spec-tasks
status: approved
issue: 91
related:
  - ./requirements.md
  - ./design.md
  - ./decisions.md
---

# Tasks - Account Templates

## Aprovação Da Spec

- [x] 1. Revisar e aprovar `requirements.md`.
- [x] 2. Revisar e aprovar `design.md`.
- [x] 3. Revisar e aprovar esta lista de tasks.
- [x] 4. Confirmar na BrasilAPI os dez registros e suas `logo_url`, falhando diante de URL ausente ou divergente do catálogo versionado.

## Catálogo E Assets

- [x] 5. Criar constantes/tipos próprios de account templates, incluindo os dez `colorToken` institucionais.
- [x] 6. Criar catálogo institucional versionado com UUIDs, chaves, códigos, ISPBs, source logo URLs, checksums, tokens e storage keys determinísticos.
- [x] 7. Criar comando explícito de curadoria que consulta BrasilAPI e compara os dez registros versionados.
- [x] 8. Baixar cada SVG indicado por `logo_url` somente via HTTPS na origem/prefixo allowlisted, rejeitando redirects externos.
- [x] 9. Validar status, content type, bytes, tamanho, checksum e markup seguro do SVG antes do upload.
- [x] 10. Fazer upload idempotente com `image/svg+xml` no bucket público configurado, sob `banking-institutions-icons/<slug>.svg`.
- [x] 11. Verificar cada objeto armazenado por HEAD/checksum, registrar o manifesto de curadoria e impedir overwrite silencioso quando os bytes mudarem sob a mesma URL.
- [x] 12. Adicionar scripts npm explícitos de curadoria, seed e reconciliação; nenhum deles roda no startup normal.

## Domain E Application

- [x] 13. Criar `AccountTemplate` e seus value objects/enums sem dependências de framework.
- [x] 14. Criar `IAccountTemplateRepository` com operações de seleção, rendering batch, save e upsert do catálogo.
- [x] 15. Alterar `Account` para carregar `templateId` nullable durante `DB-COMPAT-002`.
- [x] 16. Criar listagem de templates institucionais ativos.
- [x] 17. Criar seed institucional idempotente e transacional sem acesso de rede.
- [x] 18. Criar reconciler em lotes para accounts com `template_id IS NULL`, com lock e recheck transacional.
- [x] 19. Alterar create account para suportar `template` institucional/customizado ou payload legado mutuamente exclusivos.
- [x] 20. Alterar update account para suportar `template` institucional/customizado, compatibilidade legada e detecção de divergência após writer v0.3.
- [x] 21. Garantir que template/account e dual-write sejam salvos atomicamente com o transaction manager propagado.
- [x] 22. Alterar list/create/update para carregar o template necessário ao response sem N+1 queries.
- [x] 23. Definir projeção central do token institucional para um `ColorToken` reconhecido pela v0.3 (`icon=landmark`) e projeção custom (`colorToken`/`iconKey`).
- [x] 24. Preservar campos legados no payload de cache e tolerar entradas de cache sem dados novos.

## Persistence E Migration Expand

- [x] 25. Ler novamente `docs/database/schema.md`, migrations de accounts e a spec aprovada imediatamente antes de criar a migration.
- [x] 26. Criar `AccountTemplateOrmEntity` e mapper seguindo os nomes/constraints aprovados.
- [x] 27. Adicionar `template_id` nullable à `AccountOrmEntity` sem remover `color`/`icon`.
- [x] 28. Criar migration expand incremental para `account_templates`, FK/índices e `accounts.template_id` nullable.
- [ ] 29. Medir linhas, tamanho e taxa de escrita de `accounts`; revisar SQL, locks, nomes, `up/down/up` e ausência de `DROP`/`NOT NULL` prematuros, usando migration não transacional e `CREATE INDEX CONCURRENTLY` se o índice comum tiver risco operacional relevante.
- [x] 30. Registrar `DB-COMPAT-002` como `EXPAND_ACTIVE` em `docs/architecture/compatibility.md`, com release real quando conhecida.
- [x] 31. Atualizar `docs/database/schema.md` no mesmo change set da migration com a tabela nova, coluna nullable, constraints, índices e shims `color`/`icon`.
- [ ] 32. Medir `count(*)` de accounts sem template antes do backfill e escolher batch size a partir do volume observado.
- [x] 33. Validar migration e compatibilidade em PostgreSQL real.

## Presentation E Contrato HTTP

- [x] 34. Adicionar discriminadores centralizados `account.item` e `account_template.item` conforme os DTOs aprovados.
- [x] 35. Criar `AccountTemplateResponseDto` sem bucket, storage key ou owner.
- [x] 36. Criar `GET /account-templates` protegido por JWT.
- [x] 37. Adicionar união discriminada `template` a create/update, validação aninhada e rejeição de payload misto.
- [x] 38. Adicionar `templateId`/`template` aos responses de account.
- [x] 39. Manter `color`/`icon` nos requests/responses e marcá-los deprecated no Swagger durante `DB-COMPAT-002`.
- [x] 40. Traduzir novos erros com `platform-errors` e o filtro global.
- [x] 41. Garantir que custom template de outro usuário retorne not found sem enumeração.
- [x] 41.1. Tornar `Account` e `AccountTemplate` aggregate roots explícitos sem criar relação de ownership entre eles.
- [x] 41.2. Marcar propriedades e comportamentos `color`/`icon` do domínio como legados para orientar quem desenvolve a feature.

## Testes

- [x] 42. Criar testes puros de domínio de `AccountTemplate` e dos value objects.
- [x] 43. Testar use case de catálogo institucional ativo.
- [x] 44. Testar seleção institucional ativa, referência de tipo incorreto, template indisponível e criação customizada soberana pelo backend.
- [x] 45. Testar create/update institucional, customizado e legado, payload misto, classificação soberana do backend e atomicidade.
- [x] 46. Testar rendering de template inativo já associado.
- [x] 47. Testar fallback de linha/cache v0.3 e divergência causada por writer legado.
- [x] 48. Testar seed executado duas vezes sem duplicação e com atualização determinística.
- [x] 49. Testar reconciler repetido, concorrente e retomado após falha.
- [x] 50. Testar constraints, FKs e índices da migration em PostgreSQL real, incluindo bloqueio de template referenciado e cascade de usuário com account/template customizado.
- [x] 51. Testar operação equivalente à v0.3 depois da expand: create, update e list usando somente `color`/`icon`.
- [x] 52. Testar code N+1 no schema expandido e confirmar que code N+1 antes da expand falha de forma prevista pela ordem de deploy.
- [x] 53. Criar E2E do catálogo, contratos novo/legado, deprecações e ausência de campos internos.
- [x] 54. Executar `EXPLAIN (ANALYZE, BUFFERS)` nas consultas relevantes com volume representativo e registrar o resultado.
- [x] 55. Rodar build, typecheck, lint check e suites relevantes.

## Documentação E Operação

- [x] 56. Atualizar `docs/accounts/concepts/account.md`, removendo a responsabilidade visual direta somente quando o código novo existir.
- [x] 57. Criar conceito/fluxos e atualizar invariantes, README e open questions de `docs/accounts/**`.
- [x] 58. Criar documentação de `GET /account-templates` e atualizar create/update/list/default CASH em `docs/integrations/accounts/**`.
- [x] 59. Atualizar Swagger e exemplos de responses com `object`, `templateId`, `template` e campos deprecated.
- [x] 60. Documentar execução dos comandos de curadoria, seed e reconciliação sem expor chaves.
- [x] 61. Registrar ordem operacional de migration, ativação, seed, backfill, observação e rollback.
- [x] 62. Registrar consultas/telemetria que comprovam os gates de `DB-COMPAT-002`.

## Contract Futuro - V0.5

As tarefas abaixo ficam bloqueadas nesta feature. Só podem ser movidas para uma spec/migration nova após `DB-COMPAT-002` atingir `READY_TO_CONTRACT` com evidência.

- [ ] 63. Confirmar que v0.3 e escritores legados não são mais elegíveis para rollback.
- [ ] 64. Confirmar zero `template_id IS NULL`, zero divergência e zero payload legado na janela acordada.
- [ ] 65. Criar migration contract separada para `SET NOT NULL template_id` e remoção de `color`/`icon`.
- [ ] 66. Remover dual-read, dual-write, reconciler e campos legados do cache/HTTP.
- [ ] 67. Atualizar `docs/database/schema.md`, integrações e Swagger para o estado final.
- [ ] 68. Marcar `DB-COMPAT-002` como `RETIRED` com versão e evidência.
