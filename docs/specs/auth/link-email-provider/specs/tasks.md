---
area: auth
feature: link-email-provider
type: spec-tasks
status: current
issue: https://github.com/danzSTK/personal-finance-backend/issues/79
related:
  - ./requirements.md
  - ./design.md
  - ./decisions.md
---

# Tasks - Link EMAIL Provider Ao E-mail Principal

## Spec E Aprovação

- [x] 1. Revisar issue #79 contra código, docs de auth, schema e contrato de
     integração atuais.
- [x] 2. Criar `requirements.md`, `design.md`, `tasks.md` e `decisions.md`.
- [x] 3. Documentar a aceitação temporária e o descarte integral do campo legado
     `email`.
- [x] 4. Mapear o fluxo existente de `user.created`, outbox, challenge,
     confirmação e `user.email.verified`.
- [x] 5. Registrar a colisão entre `PENDING_PROFILE` e
     `PENDING_EMAIL_VERIFICATION` para contas Google.
- [ ] 6. Decidir o comportamento quando o Google fornece e-mail com
     `verified !== true`.
- [ ] 7. Decidir se adicionar senha exige reautenticação recente, alteração de
     sessões ou notificação de segurança.
- [ ] 8. Revisar e aprovar explicitamente `requirements.md`, `design.md` e esta
     lista antes do código.

## Auditoria E Rollout

- [ ] 9. Executar em ambiente autorizado a contagem sanitizada de providers
     `EMAIL` cujo `provider_user_id` difere de `users.email`.
- [ ] 10. Registrar em `decisions.md` o resultado agregado da auditoria, sem PII.
- [ ] 11. Se houver divergências, aprovar estratégia de correção antes de criar
      migration ou script.
- [ ] 12. Se houver correção persistida, aplicar `migration-rollout`, documentar
      N/N+1 e atualizar schema/compatibilidade conforme necessário.

## Contrato HTTP E Presentation

- [ ] 13. Tornar `email` opcional, depreciado e ignorado no
      `LinkEmailProviderDto` durante a versão de transição.
- [ ] 14. Manter `password` obrigatório com limites centralizados de caracteres e
      bytes UTF-8.
- [ ] 15. Alterar controller para nunca repassar `email` ao caso de uso.
- [ ] 16. Remover `sessionMetadata` do input do caso de uso se a decisão de
      segurança não lhe der uma finalidade explícita.
- [ ] 17. Criar response DTO com discriminador `object` centralizado e sem dados
      sensíveis.
- [ ] 18. Atualizar Swagger com request novo, campo legado depreciado, resposta e
      erros.

## Application, Domain E Persistência

- [ ] 19. Remover `email` de `LinkEmailProviderUseCaseDto`.
- [ ] 20. Carregar usuário por `userId` com lock pessimista dentro da transação.
- [ ] 21. Derivar `providerUserId` exclusivamente de `user.email.value`.
- [ ] 22. Revalidar provider existente e conflito entre contas dentro da mesma
      transação.
- [ ] 23. Preservar hash fora do lock sem enfraquecer validação ou expor senha.
- [ ] 24. Persistir o aggregate com o transaction manager e invalidar cache.
- [ ] 25. Traduzir violação de `UQ_auth_providers` para erro de aplicação estável.
- [ ] 26. Garantir que e-mail, status, perfil e providers anteriores permaneçam
      inalterados.

## Google OAuth - Bloqueado Pela Decisão

- [ ] 27. Testar e preservar a regra de que profile sem e-mail não cria usuário,
      provider, sessão, cookies ou outbox.
- [ ] 28. Validar explicitamente o atributo `verified` do e-mail Google conforme
      `DEC-006`.
- [ ] 29. Criar contrato estável e redirect frontend para falha de e-mail Google.
- [ ] 30. Atualizar fluxo de status/eventos somente se a alternativa aprovada
      exigir verification Danfy.
- [ ] 31. Se necessário, modelar separadamente perfil pendente e e-mail pendente
      antes de ativar Google não verificado.

## Testes

- [ ] 32. Atualizar testes do DTO para request novo, legado ignorado e limites
      72/73 bytes.
- [ ] 33. Atualizar testes do controller comprovando que `email` nunca chega ao
      caso de uso.
- [ ] 34. Refatorar testes do use case para usar e-mail principal do domain user.
- [ ] 35. Cobrir provider existente, usuário ausente e conflito entre contas.
- [ ] 36. Cobrir tradução da unique violation conhecida.
- [ ] 37. Criar teste PostgreSQL de duas tentativas concorrentes.
- [ ] 38. Criar E2E do vínculo seguido de logout e login local pelo e-mail
      principal.
- [ ] 39. Criar E2E provando que o e-mail legado divergente não autentica.
- [ ] 40. Criar testes da estratégia/callback Google para e-mail ausente,
      verificado e não verificado.
- [ ] 41. Se verification for reutilizada, cobrir outbox, envio automático,
      confirmação e transição final de status no nível adequado.

## Documentação E Entrega

- [ ] 42. Atualizar docs de fluxo/conceito de auth.
- [ ] 43. Atualizar integração de link providers e OAuth Google.
- [ ] 44. Atualizar endpoints, erros, Swagger e response objects.
- [ ] 45. Atualizar a spec existente de email verification se seu escopo passar a
      incluir Google.
- [ ] 46. Registrar tarefa/versão de remoção definitiva do campo legado `email`.
- [ ] 47. Rodar format, lint, build, unitários, integração e E2E aplicáveis.
- [ ] 48. Revisar invariantes de segurança, tenant, atomicidade e compatibilidade.
- [ ] 49. Atualizar esta lista e as decisões se a implementação revelar mudança
      de regra ou design.
