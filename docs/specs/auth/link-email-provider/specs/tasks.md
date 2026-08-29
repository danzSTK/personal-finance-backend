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
- [x] 6. Separar a verificação do e-mail Google na issue #90, preservando o fluxo
     atual nesta entrega.
- [x] 7. Preservar a segurança atual do endpoint, sem reautenticação recente,
     alteração de sessões ou notificação adicional.
- [x] 8. Revisar e aprovar explicitamente `requirements.md`, `design.md` e esta
     lista antes do código.

## Auditoria E Rollout

- [x] 9. Executar em ambiente autorizado a contagem sanitizada de providers
     `EMAIL` cujo `provider_user_id` difere de `users.email`.
- [x] 10. Registrar em `decisions.md` o resultado agregado da auditoria, sem PII.
- [x] 11. Confirmar que não há divergências no ambiente local auditado e que não
      será criada correção de dados nesta feature.
- [x] 12. Confirmar que não há mudança persistida e, portanto, não há migration,
      matriz N/N+1 ou atualização de schema.

## Contrato HTTP E Presentation

- [x] 13. Tornar `email` opcional, depreciado e ignorado no
      `LinkEmailProviderDto` durante a versão de transição.
- [x] 14. Manter `password` obrigatório com limites centralizados de caracteres e
      bytes UTF-8.
- [x] 15. Alterar controller para nunca repassar `email` ao caso de uso.
- [x] 16. Remover `sessionMetadata` do input do caso de uso se a decisão de
      segurança não lhe der uma finalidade explícita.
- [x] 17. Criar response DTO com discriminador `object` centralizado e sem dados
      sensíveis.
- [x] 18. Atualizar Swagger com request novo, campo legado depreciado, resposta e
      erros.

## Application, Domain E Persistência

- [x] 19. Remover `email` de `LinkEmailProviderUseCaseDto`.
- [x] 20. Carregar usuário por `userId` com lock pessimista dentro da transação.
- [x] 21. Derivar `providerUserId` exclusivamente de `user.email.value`.
- [x] 22. Revalidar provider existente e conflito entre contas dentro da mesma
      transação.
- [x] 23. Preservar hash fora do lock sem enfraquecer validação ou expor senha.
- [x] 24. Persistir o aggregate com o transaction manager e invalidar cache.
- [x] 25. Traduzir violação de `UQ_auth_providers` para erro de aplicação estável.
- [x] 26. Garantir que e-mail, status, perfil e providers anteriores permaneçam
      inalterados.

## Google OAuth

- [x] 27. Registrar a issue #90 e manter GoogleStrategy, callback, status e
      eventos fora desta implementação.

## Testes

- [x] 32. Atualizar testes do DTO para request novo, legado ignorado e limites
      72/73 bytes.
- [x] 33. Atualizar testes do controller comprovando que `email` nunca chega ao
      caso de uso.
- [x] 34. Refatorar testes do use case para usar e-mail principal do domain user.
- [x] 35. Cobrir provider existente, usuário ausente e conflito entre contas.
- [x] 36. Cobrir tradução da unique violation conhecida.
- [x] 37. Criar teste PostgreSQL de duas tentativas concorrentes.
- [x] 38. Criar integração PostgreSQL do vínculo seguida de login local real pelo
      e-mail principal.
- [x] 39. Combinar E2E do campo legado ignorado com integração provando que
      endereço alternativo não autentica.

## Documentação E Entrega

- [x] 42. Atualizar docs de fluxo/conceito de auth.
- [x] 43. Atualizar integração de link providers.
- [x] 44. Atualizar endpoints, erros, Swagger e response objects.
- [x] 45. Manter a spec de email verification inalterada; evolução Google segue
      na issue #90.
- [x] 46. Registrar em `DEC-003` a remoção definitiva do campo legado `email` na
      próxima versão coordenada.
- [x] 47. Rodar format, lint, build, unitários, integração e E2E aplicáveis.
- [x] 48. Revisar invariantes de segurança, tenant, atomicidade e compatibilidade.
- [x] 49. Atualizar esta lista e as decisões se a implementação revelar mudança
      de regra ou design.
