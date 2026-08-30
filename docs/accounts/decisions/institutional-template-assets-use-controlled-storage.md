---
area: accounts
type: decision
status: accepted
issue: 91
related:
  - ../../specs/accounts/account-templates/specs/design.md
  - ../../database/schema.md
  - ../../assets/README.md
---

# Assets Institucionais Usam Storage Controlado Pela Danfy

## Decisão

Armazenar logos institucionais no Object Storage público da Danfy sem criar registros na tabela `assets`.

O `account_template` persiste somente a storage key relativa. Bucket e base URL são resolvidos por configuração interna da aplicação.

Destino definido para a primeira curadoria:

```text
bucket: danfy-public-bucket
prefixo: banking-institutions-icons/
```

## Coleta

O comando de curadoria consulta a BrasilAPI v1 e confere a `logo_url` versionada de cada instituição. O download aceita somente URLs no formato:

```text
https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/<ispb>.svg
```

Status, origem HTTPS, prefixo, content type, tamanho, checksum e estrutura SVG são validados. O arquivo vetorial é preservado para qualidade de renderização, mas DTD/entities, `script`, `foreignObject`, atributos de evento e referências externas executáveis são rejeitados. Checksums SHA-256 impedem que uma alteração sob a mesma URL substitua silenciosamente um asset já curado.

## Motivos

- A tabela `assets` modela arquivos pertencentes a usuários e outro lifecycle.
- Logos institucionais são globais e mantidas pela plataforma.
- Persistir somente a key evita acoplar dados ao nome do bucket ou à URL de um ambiente.
- Servir uma cópia controlada remove dependência da BrasilAPI e do CDN externo em runtime.

## Consequências

- O frontend recebe uma URL já derivada; nunca recebe bucket ou storage key.
- Falha de download, validação ou upload impede publicar o item curado.
- Lifecycle detalhado de substituição/remoção de logos será definido antes da primeira atualização posterior ao catálogo inicial.
