# Tarefas — limite UTF-8 de senhas locais

- [x] 1. Registrar requisitos, design e decisões da correção.
- [ ] 2. Criar constante e utilitário puro de limite UTF-8.
- [ ] 3. Criar o erro compartilhado `PASSWORD_BYTE_LIMIT_EXCEEDED` e seu mapping.
- [ ] 4. Criar decorator reutilizável do `class-validator`.
- [ ] 5. Aplicar o decorator nos DTOs efetivos de criação e alteração.
- [ ] 6. Proteger `BcryptHashService.hash()` e `compare()` antes do bcrypt.
- [ ] 7. Preservar `401 Invalid credentials` na `LocalStrategy` para o erro de
      limite.
- [ ] 8. Cobrir utilitário, decorator, serviço, strategy e fluxos HTTP.
- [ ] 9. Atualizar Swagger e documentação de integração.
- [ ] 10. Executar unitários, E2E relevantes, lint, typecheck e build.
