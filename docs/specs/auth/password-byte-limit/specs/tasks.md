# Tarefas — limite UTF-8 de senhas locais

- [x] 1. Registrar requisitos, design e decisões da correção.
- [x] 2. Criar constante e utilitário puro de limite UTF-8.
- [x] 3. Criar o erro compartilhado `PASSWORD_BYTE_LIMIT_EXCEEDED` e seu mapping.
- [x] 4. Criar decorator reutilizável do `class-validator`.
- [x] 5. Aplicar o decorator nos DTOs efetivos de criação e alteração.
- [x] 6. Proteger `BcryptHashService.hash()` e `compare()` antes do bcrypt.
- [x] 7. Preservar `401 Invalid credentials` na `LocalStrategy` para o erro de
      limite.
- [x] 8. Cobrir utilitário, decorator, serviço, strategy e fluxos HTTP.
- [x] 9. Atualizar Swagger e documentação de integração.
- [x] 10. Executar unitários, E2E relevantes, lint, typecheck e build.

## Evidências de validação

- `npm test -- --runInBand`: 93 suítes e 362 testes aprovados.
- `npm run test:e2e -- --runInBand change-password.e2e-spec.ts`: 6 testes
  aprovados, incluindo rejeição HTTP antes do use case.
- `npm run typecheck`: aprovado.
- `npm run lint:check`: aprovado.
- `npm run build`: aprovado.
