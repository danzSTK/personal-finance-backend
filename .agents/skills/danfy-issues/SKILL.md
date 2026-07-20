---
name: danfy-issues
description: Classificar, redigir, revisar e publicar issues do GitHub para o projeto Danfy. Use quando o usuário pedir para criar, abrir, documentar ou melhorar uma issue de bug, feature, alteração técnica, incidente ou tarefa simples neste repositório.
---

# Danfy Issues

Responda em português por padrão e trate `docs/platform/issue-standards.md` como a fonte canônica. Leia também o template correspondente em `.github/ISSUE_TEMPLATE/` antes de redigir ou publicar.

## Fluxo

1. Reunir evidências no código, documentação, logs ou relato fornecido. Não transformar hipótese em fato.
2. Verificar issues existentes quando houver acesso ao GitHub, evitando duplicatas.
3. Classificar a issue pelo resultado principal.
4. Escolher um prefixo de área, como `[API]`, `[WEB]`, `[AUTH]`, `[DATABASE]`, `[INFRA]` ou `[DOCS]`.
5. Redigir somente as seções aplicáveis do template.
6. Revisar título, comportamento observável, critérios, riscos e ausência de segredos.
7. Publicar apenas quando o usuário pedir para abrir ou criar a issue no GitHub. Se ele pedir apenas um rascunho, não publicar.

Ao publicar, usar o repositório indicado pelo usuário ou confirmar pelo remote Git. Consultar as labels existentes e reutilizar seus nomes exatos; não criar labels, milestones ou projetos sem solicitação explícita.

## Classificação

- **Bug:** comportamento existente incorreto, regressão ou contrato quebrado.
- **Feature:** novo comportamento ou capacidade percebida pelo usuário.
- **Alteração técnica:** mudança interna, infraestrutura, observabilidade, segurança, performance, dependência, deploy, refatoração ou dívida técnica sem nova capacidade de usuário.
- **Incidente:** evento que afetou produção, usuários, disponibilidade, segurança ou integridade dos dados.
- **Tarefa simples:** trabalho pequeno, objetivo e de baixo risco que não precisa de template extenso.

Quando um incidente revelar uma correção permanente, registrar o ocorrido como incidente e criar uma issue separada de bug ou alteração técnica para a ação preventiva, caso isso ajude no acompanhamento.

## Seções

### Bug

Obrigatórias: `Contexto`, `Comportamento atual` e `Comportamento esperado`.

Opcionais: `Reprodução` e `Possíveis ações`. Incluir reprodução sempre que os passos forem conhecidos. Possíveis ações são hipóteses, não compromisso de implementação.

### Feature

Obrigatórias: `Contexto`, `Objetivo`, `Escopo`, `Regras de negócio` e `Critérios de aceitação`.

Opcionais: `Fora de escopo`, `Impactos e riscos` e `Observações técnicas`.

### Alteração técnica

Obrigatórias: `Contexto`, `Problema`, `Objetivo técnico`, `Proposta`, `Critérios de conclusão` e `Validação`.

Opcionais: `Impactos e riscos` e `Rollback`. Incluir rollback quando houver risco operacional relevante.

### Incidente

Usar `Resumo`, `Impacto`, `Detecção`, `Linha do tempo`, `Causa`, `Resolução`, `Ações preventivas` e `Aprendizados`. Marcar causas não confirmadas como hipótese e atualizar a issue quando novas evidências surgirem.

### Tarefa simples

Usar apenas `Objetivo` e `Critérios de conclusão`.

## Critérios De Qualidade

- Escrever títulos como resultados ou comportamentos claros, sem prefixar o tipo da issue; o prefixo representa a área.
- Descrever o problema antes de sugerir a solução.
- Manter contexto suficiente para outra pessoa entender a issue sem reconstruir toda a investigação.
- Escrever critérios de aceitação observáveis, verificáveis e independentes da implementação.
- Preferir Dado/Quando/Então quando isso deixar o cenário mais preciso.
- Não usar detalhes como “criar classe X” como critério de aceitação de feature.
- Não preencher seção opcional com “não aplicável”; remover a seção.
- Não incluir senhas, tokens, chaves, cookies, dados pessoais ou dumps sensíveis.
- Não prometer escopo, causa ou solução sem evidência.

Exemplo ruim:

```text
Criar um EmailVerificationService.
```

Exemplo adequado:

```text
Dado um usuário ainda não confirmado,
quando ele solicitar um novo e-mail de confirmação,
então um novo link válido deverá ser enviado,
respeitando o cooldown configurado.
```

## Publicação

Antes de abrir a issue:

- verificar título e possíveis duplicatas;
- remover comentários de preenchimento e seções opcionais vazias;
- confirmar que os critérios podem ser testados;
- aplicar somente labels existentes e relevantes;
- preservar links úteis para specs, logs sanitizados, commits ou incidentes relacionados.

Depois de publicar, informar número, título, labels e URL da issue.
