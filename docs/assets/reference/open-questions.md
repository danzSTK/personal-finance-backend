---
area: assets
type: reference
status: open
---

# Assets Open Questions

- Manter `CHK_assets_checksum` fixo em SHA-256 ou registrar também o algoritmo?
- Qual janela torna `PENDING_UPLOAD` abandonado?
- Qual frequência do reconciliador?
- Por quanto tempo linhas `DELETED` serão retidas?
- Como detectar objetos existentes no R2 sem linha no banco sem listar namespaces excessivamente grandes?
- Repository de assets terá cache? A tendência inicial é não, pois seus estados operacionais exigem leitura consistente.
