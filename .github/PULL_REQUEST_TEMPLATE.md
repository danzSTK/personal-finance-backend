> External code contributions are not currently open. This template is intended only for the maintainer and collaborators who received prior written authorization. See [CONTRIBUTING.md](../CONTRIBUTING.md).

## Issue vinculada

<!-- Obrigatório quando a PR resolve uma issue: substitua #000 pelo número real (ex.: Closes #144). -->
<!-- ATENÇÃO: como a branch padrão do repositório é `main` e PRs miram `develop`, garanta também o vínculo no painel lateral `Development` da Issue, vinculando a PR aberta logo após criá-la via GraphQL `addCloseIssueReferences` (ou GitHub UI). NÃO crie outra branch se o trabalho já estiver em um worktree/branch existente; use `gh issue develop <N> --base develop --name <branch>` apenas se ainda não existir branch criada. -->

Closes #<numero-da-issue>

## Resumo

<!-- Explique objetivamente o que esta PR altera e por quê. -->

## Tipo de mudança

- [ ] Funcionalidade
- [ ] Correção
- [ ] Refatoração
- [ ] Testes
- [ ] Documentação
- [ ] Infraestrutura, CI ou CD

## Alterações

- <!-- Alteração principal. -->

## Validação

<!-- Liste os comandos e verificações realmente executados. -->

```text
comando ou verificação
```

## Impactos

- [ ] Não altera contratos HTTP.
- [ ] Não altera o schema do banco de dados.
- [ ] Não adiciona ou modifica variáveis de ambiente.
- [ ] Não altera processamento assíncrono, filas ou eventos.

<!-- Explique abaixo os impactos marcados como não aplicáveis ou as alterações existentes. -->

## Documentação e especificações

- [ ] A documentação afetada foi atualizada.
- [ ] As specs foram criadas ou atualizadas quando necessárias.
- [ ] Migrations e `docs/database/schema.md` estão alinhados quando existe mudança de banco.

## Segurança

- [ ] Nenhum secret, token, credencial ou dado sensível foi incluído.
- [ ] Autenticação, autorização e isolamento por usuário foram revisados quando aplicáveis.
- [ ] Logs e respostas não expõem detalhes internos ou dados sensíveis.

## Riscos e rollback

<!-- Descreva riscos conhecidos e como retornar ao estado anterior. Use "Não se aplica" quando apropriado. -->

## Evidências

<!-- Inclua logs, respostas HTTP, screenshots ou outros resultados úteis para a revisão. -->
