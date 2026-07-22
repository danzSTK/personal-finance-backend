# Publicacao Da Imagem — Tarefas

- [x] 1. Definir gatilho e fronteira entre publicacao e deploy.
- [x] 2. Definir `linux/amd64` e `linux/arm64` como plataformas suportadas.
- [x] 3. Definir runners nativos e publicacao intermediaria por digest.
- [x] 4. Definir politica de scan e tags da imagem.
- [x] 5. Exigir `APP_VERSION` no Compose base.
- [x] 6. Mover configuracoes de build para os overrides local e da CI.
- [x] 7. Atualizar exemplo e fixture de ambiente.
- [x] 8. Criar workflow de build, scan e publicacao no GHCR.
- [x] 9. Fixar actions privilegiadas por SHA completo.
- [x] 10. Validar configuracoes Compose e formatacao.
- [x] 11. Executar smoke test local de containers.
- [ ] 12. Validar a primeira publicacao multi-arquitetura no GitHub.
- [x] 13. Corrigir a selecao de plataforma do Trivy na matriz multi-arquitetura.
- [x] 14. Atualizar o npm do estagio final para eliminar vulnerabilidades corrigiveis da imagem base.
- [ ] 15. Validar a publicacao corrigida em uma nova GitHub Release.
