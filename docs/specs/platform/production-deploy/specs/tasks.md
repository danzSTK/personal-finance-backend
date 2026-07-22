# Deploy De Produção — Tarefas

- [x] 1. Definir gatilho, digest, metadados e fronteira com o executor remoto.
- [x] 2. Definir permissões, Environment, OIDC/Tailscale e credencial GHCR por stdin.
- [x] 3. Definir concurrency, timeout, saúde externa e rollback condicional.
- [x] 4. Exportar o manifest digest no job de publicação.
- [x] 5. Adicionar o job `deploy-production` ao Backend CD.
- [x] 6. Coletar logs e status com `always()`.
- [x] 7. Aceitar o ator sintético de GitHub App no executor e ampliar seus testes.
- [x] 8. Validar Prettier, `actionlint`, ShellCheck e testes locais.
- [x] 9. Publicar os commits no backend e no `danfy-infra`.
- [x] 10. Validar conectividade e primeiro deploy após merge e aprovação de produção.
- [x] 11. Usar `tailscale ssh` para verificar a chave do host em runners efêmeros.
- [x] 12. Corrigir a sintaxe do wrapper, delimitar sessões remotas e propagar falhas através de `tee`.

Validação concluída pela release [`v0.1.3`](https://github.com/danzSTK/personal-finance-backend/releases/tag/v0.1.3) e pela execução bem-sucedida do [Backend CD](https://github.com/danzSTK/personal-finance-backend/actions/runs/29884311414), incluindo scans AMD64/ARM64, publicação multi-arquitetura, deploy imutável, readiness externa e coleta do status remoto.
