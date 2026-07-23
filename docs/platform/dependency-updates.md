---
area: platform
type: operations
status: current
related:
  - ../specs/platform/dependency-updates/specs/requirements.md
  - ../specs/platform/dependency-updates/specs/design.md
  - ./continuous-integration.md
---

# Atualizações de dependências

O Dependabot monitora semanalmente as dependências npm, GitHub Actions e imagens Docker do Danfy Backend. A configuração executável está em [`.github/dependabot.yml`](../../.github/dependabot.yml).

O serviço propõe alterações por pull request; ele não aprova nem faz merge automaticamente.

## Rotina semanal

As verificações acontecem às segundas-feiras em `America/Fortaleza`:

| Horário | Ecossistema    | Manifestos                                        | Limite |
| ------- | -------------- | ------------------------------------------------- | ------ |
| 09:00   | npm            | `api/package.json` e `api/package-lock.json`      | 5 PRs  |
| 09:30   | GitHub Actions | `.github/workflows/*.yml`                         | 3 PRs  |
| 10:00   | Docker         | `api/Dockerfile`                                  | 2 PRs  |
| 10:30   | Docker Compose | `docker-compose.yml` e demais Compose versionados | 2 PRs  |

```text
segunda-feira
      |
      v
Dependabot consulta os registries
      |
      v
identifica atualizações
      |
      v
abre pull requests
      |
      v
Backend CI valida as mudanças
      |
      v
maintainer revisa changelogs e testes
      |
      v
merge, ajuste, adiamento ou fechamento
```

Atualizações minor e patch de npm são reunidas no grupo `npm-minor-and-patch`. Para Actions, o grupo equivalente é `actions-minor-and-patch`. Atualizações major permanecem em PRs individuais para receber uma revisão mais cuidadosa.

Dockerfile e Docker Compose também permanecem em PRs individuais. Uma mudança de imagem pode afetar o build, o runtime ou o smoke test mesmo quando a tag parece pequena.

Por padrão, o GitHub aplica um cooldown de três dias às version updates recém-publicadas. Uma versão lançada muito perto da janela semanal pode aparecer somente na semana seguinte. Esse cooldown não se aplica a security updates.

## Vulnerabilidades

Dependabot Security Updates não aguarda a janela semanal. Quando o dependency graph associa um advisory a uma dependência vulnerável e encontra uma versão corrigida, o GitHub tenta criar uma PR de segurança.

```text
GitHub Advisory publicado
      |
      v
Dependabot Alert
      |
      v
Security Update tenta criar uma PR
      |
      v
Backend CI valida a correção
      |
      v
revisão e merge prioritário
```

Se nenhuma atualização compatível estiver disponível, o alert pode permanecer aberto sem uma PR automática. Nesse caso, avalie atualização major, substituição da dependência, mitigação temporária ou aceitação documentada do risco.

Os valores de `open-pull-requests-limit` configurados para cada ecossistema controlam version updates. Security updates usam um limite interno separado do GitHub.

Não publique detalhes exploráveis da vulnerabilidade em uma issue. Siga a [Política de Segurança](../../SECURITY.md).

## Como revisar uma PR

1. Confirme se a PR é uma version update ou security update.
2. Leia os changelogs de todas as dependências incluídas.
3. Procure breaking changes, migrations, mudanças de configuração e requisitos de runtime.
4. Verifique a origem do pacote, da imagem ou da Action e a versão proposta.
5. Aguarde todos os jobs da Backend CI.
6. Para Docker e Actions, revise também alterações de supply chain e permissões.
7. Faça merge somente quando o escopo estiver compreendido.

CI verde confirma o comportamento coberto pelos testes, mas não substitui a leitura do changelog nem a análise operacional.

## Labels e commits

| Origem         | Prefixo          | Labels                           |
| -------------- | ---------------- | -------------------------------- |
| npm            | `chore(deps)`    | `dependencies`, `backend`        |
| GitHub Actions | `chore(actions)` | `dependencies`, `github-actions` |
| Dockerfile     | `chore(docker)`  | `dependencies`, `docker`         |
| Docker Compose | `chore(compose)` | `dependencies`, `docker`         |

As labels `dependencies`, `backend`, `github-actions` e `docker` estão provisionadas no repositório. Se a configuração for reutilizada em outro repositório, essas labels também precisam ser criadas; o GitHub ignora silenciosamente uma label inexistente.

## Manutenção

Atualize `.github/dependabot.yml` quando:

- um manifest mudar de diretório;
- um novo ecossistema for adicionado;
- a janela semanal ou os limites deixarem de atender à triagem;
- um registry privado passar a ser necessário;
- a política de agrupamento mudar.

Depois do merge de uma alteração:

1. abra **Insights → Dependency graph → Dependabot**;
2. confirme que os quatro ecossistemas foram reconhecidos;
3. verifique erros de configuração ou autenticação;
4. acompanhe a primeira execução agendada;
5. confirme que a PR gerada executa a Backend CI.

Referências oficiais:

- [Configuração do Dependabot Version Updates](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-version-updates);
- [Dependabot Security Updates](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-security-updates);
- [Opções do dependabot.yml](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference).
