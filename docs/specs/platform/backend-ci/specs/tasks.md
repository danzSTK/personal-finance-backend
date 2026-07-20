# Backend CI — Tarefas

- [x] 1. Mapear scripts de qualidade e suites existentes no backend.
- [x] 2. Medir o baseline de formatacao, lint, typecheck, build e testes.
- [x] 3. Corrigir a tipagem dos testes que impedia o `typecheck`.
- [x] 4. Criar workflow com jobs de qualidade, testes e integracao.
- [x] 5. Configurar Node.js 22, cache npm, permissoes e concorrencia.
- [x] 6. Excluir alteracoes somente de documentacao dos gatilhos automaticos.
- [x] 7. Criar exemplo didatico comentado em `docs/platform/`.
- [x] 8. Abrir o workflow em uma draft PR contra `develop` e corrigir a configuracao exigida pelo job de testes.
- [x] 9. Definir requisitos e desenho do smoke test de containers.
- [x] 10. Criar fixture de ambiente e overlay Compose isolado para a CI.
- [x] 11. Adicionar health check da API ao Compose.
- [x] 12. Adicionar job de build, migrations, startup e health checks.
- [x] 13. Atualizar o exemplo didatico da pipeline.
- [x] 14. Validar o smoke test sem interferir nos containers locais existentes.
- [ ] 15. Validar o novo job na draft PR contra `develop`.
- [ ] 16. Decidir quando e como os jobs se tornarao checks obrigatorios.
- [ ] 17. Planejar a fase de publicacao de imagem e deploy em workflow separado.
