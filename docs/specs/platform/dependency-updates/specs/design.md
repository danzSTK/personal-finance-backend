# Atualizações De Dependências — Design

## Arquitetura

O GitHub hospeda toda a automação:

```text
.github/dependabot.yml
        |
        +-- npm             -> /api/package.json + package-lock.json
        +-- github-actions  -> /.github/workflows/*.yml
        +-- docker          -> /api/Dockerfile
        +-- docker-compose  -> /docker-compose*.yml
```

O Dependabot apenas propõe alterações. A validação continua pertencendo a `.github/workflows/backend-ci.yml`, e o merge permanece uma decisão humana.

## Agendamento

As verificações usam intervalo semanal, segunda-feira e fuso `America/Fortaleza`:

| Ecossistema    | Horário | Limite de PRs |
| -------------- | ------- | ------------- |
| npm            | 09:00   | 5             |
| GitHub Actions | 09:30   | 3             |
| Dockerfile     | 10:00   | 2             |
| Docker Compose | 10:30   | 2             |

O escalonamento reduz a criação simultânea de PRs e torna a triagem mais previsível.

## Estratégia De Agrupamento

Npm e GitHub Actions agrupam version updates minor e patch com:

```yaml
applies-to: "version-updates"
patterns:
  - "*"
update-types:
  - "minor"
  - "patch"
```

O campo `applies-to` fica explícito para não confundir manutenção semanal com correções de segurança. Atualizações major não correspondem ao grupo e permanecem individuais.

Dockerfile e Docker Compose não recebem grupos nesta primeira versão. Cada mudança de imagem permanece isolada para facilitar a análise do artefato e do smoke test.

## Pull Requests

Cada ecossistema define labels e prefixos convencionais:

| Ecossistema    | Prefixo          | Labels                           |
| -------------- | ---------------- | -------------------------------- |
| npm            | `chore(deps)`    | `dependencies`, `backend`        |
| GitHub Actions | `chore(actions)` | `dependencies`, `github-actions` |
| Dockerfile     | `chore(docker)`  | `dependencies`, `docker`         |
| Docker Compose | `chore(compose)` | `dependencies`, `docker`         |

As labels customizadas precisam existir no repositório; quando uma label não existe, o GitHub a ignora.

As labels `backend`, `github-actions` e `docker` são provisionadas junto da configuração. `dependencies` já pertence ao conjunto de labels do repositório.

## Integração Com A Backend CI

Os filtros da Backend CI observam:

- `api/**`, cobrindo npm e o Dockerfile;
- `docker-compose.yml` e `docker-compose.dev.yml`;
- `.github/workflows/*.yml`, cobrindo qualquer Action atualizada;
- `.github/dependabot.yml`, cobrindo alterações na própria política.

Assim, tanto PRs individuais quanto agrupadas recebem os mesmos jobs de qualidade, testes e container smoke.

## Security Updates

Security updates são iniciados pelo GitHub quando um Dependabot Alert possui uma versão corrigida disponível. Eles não aguardam segunda-feira e não são agrupados pelas regras de version updates deste arquivo.

Os limites definidos em `open-pull-requests-limit` pertencem às version updates. Security updates possuem limite interno separado no GitHub e também não recebem o cooldown padrão de três dias aplicado às novas version updates.

```text
GitHub Advisory
      |
      v
Dependabot Alert
      |
      v
Security Update tenta criar PR
      |
      v
Backend CI
      |
      v
revisão e merge prioritário
```

Ativar Alerts e Security Updates continua sendo uma configuração do repositório no GitHub, não um secret nem uma permissão declarada no YAML.

## Segurança E Operação

- Nenhum secret é armazenado em `.github/dependabot.yml`.
- Não há automerge.
- Changelogs, breaking changes e resultado dos testes devem ser revisados.
- Atualizações de Actions fixadas por SHA permanecem fixadas por SHA; o Dependabot propõe a nova revisão.
- Falhas de compatibilidade são tratadas na pull request, sem desabilitar globalmente as verificações.

## Validação

- validar a sintaxe YAML;
- confirmar que cada diretório contém o manifest correspondente;
- confirmar que os filtros da Backend CI cobrem os arquivos atualizados;
- revisar no GitHub a página de Dependabot após o merge;
- validar a primeira rodada semanal e a execução real da CI.

## Impactos

- Banco de dados e contratos HTTP: nenhum.
- Runtime: nenhuma mudança direta.
- GitHub: novas pull requests automáticas de atualização.
- CI: todos os workflows passam a fazer parte dos filtros de caminho.
- Documentação: novo guia operacional de manutenção de dependências.
