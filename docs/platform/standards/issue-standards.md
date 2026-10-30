---
area: platform
type: guide
status: current
---

# Padrões de Issues — Danfy

Este documento define como classificar e escrever issues. O template deve ajudar a pensar e comunicar o trabalho, sem obrigar o preenchimento de texto vazio.

## Princípios Gerais

- O título informa a área e o resultado principal.
- O tipo da issue é representado pelo template e pelas labels, não pelo prefixo do título.
- Contexto e problema devem ser compreensíveis sem depender de uma conversa externa.
- Critérios de aceitação descrevem comportamento observável, não detalhes de implementação.
- Seções opcionais devem ser removidas quando não fizerem sentido.
- Hipóteses devem ser identificadas como hipóteses.
- Segredos, credenciais, cookies, tokens e dados pessoais não devem aparecer em issues.

Regra prática de classificação:

```text
Erro no comportamento existente   -> Bug
Novo comportamento para o usuário -> Feature
Mudança interna sem nova feature  -> Alteração técnica
Problema que afetou produção      -> Incidente
Tarefa pequena e óbvia            -> Issue simples ou somente PR
```

## Prefixos De Área

Use prefixos relacionados à área afetada, como:

```text
[API]
[WEB]
[AUTH]
[ACCOUNTS]
[DATABASE]
[INFRA]
[DOCS]
```

Novas áreas podem ser usadas quando representarem claramente um módulo ou contexto do produto.

## 1. Bug

Use para comportamento existente incorreto, regressão ou quebra de contrato.

### Formato Do Título

```text
[ÁREA] Descrever o comportamento que precisa ser corrigido
```

Exemplo:

```text
[API] Detectar indisponibilidade do banco após a inicialização
```

### Template

```md
## Contexto

Explique o contexto completo do bug e por que o comportamento é relevante.

## Comportamento atual

Descreva o que acontece atualmente, incluindo sintomas e impacto observável.

## Comportamento esperado

Descreva o resultado esperado para deixar explícita a diferença em relação ao
comportamento atual.

## Reprodução

1. Preparar o estado necessário.
2. Executar a ação que dispara o problema.
3. Observar o comportamento incorreto.

Preencher quando os passos forem conhecidos. Remover a seção quando não houver
uma reprodução confiável.

## Possíveis ações

- Hipótese de correção ou investigação.
- Componente que pode precisar de alteração.

Esta seção é opcional. As ações não representam uma decisão de implementação.
```

Obrigatório: `Contexto`, `Comportamento atual` e `Comportamento esperado`.

Opcional: `Reprodução` e `Possíveis ações`.

## 2. Feature

### Formato Do Título

```text
[ÁREA] Permitir que o usuário faça alguma coisa
```

Exemplos:

```text
[API] Permitir reenvio do e-mail de confirmação
[WEB] Adicionar filtro por período nas transações
[ACCOUNTS] Exibir saldo previsto da conta
```

### Template

```md
## Contexto

Explique por que essa funcionalidade é necessária e qual problema ou
necessidade ela atende.

## Objetivo

Descreva de forma direta o resultado que a funcionalidade deve entregar.

## Escopo

- O que será incluído nesta entrega.
- Quais comportamentos deverão existir.
- Quais partes do sistema serão afetadas.

## Fora de escopo

- O que foi considerado, mas não será feito nesta entrega.
- Melhorias que poderão ser realizadas futuramente.

## Regras de negócio

- Regra importante da funcionalidade.
- Permissões e restrições.
- Validações necessárias.
- Comportamentos esperados em casos especiais.

## Critérios de aceitação

- [ ] O usuário consegue realizar a ação principal.
- [ ] As validações definidas são aplicadas.
- [ ] Os erros esperados possuem tratamento adequado.
- [ ] A funcionalidade respeita as permissões necessárias.
- [ ] Os testes relevantes foram adicionados ou atualizados.

## Impactos e riscos

- Módulos, serviços ou integrações afetadas.
- Possíveis riscos de segurança, concorrência ou consistência.
- Necessidade de migration, configuração ou alteração de infraestrutura.

## Observações técnicas

Informações técnicas já conhecidas que podem ajudar na implementação.

Não é necessário definir toda a solução antecipadamente.
```

Obrigatório: `Contexto`, `Objetivo`, `Escopo`, `Regras de negócio` e `Critérios de aceitação`.

Opcional: `Fora de escopo`, `Impactos e riscos` e `Observações técnicas`.

### Critérios De Aceitação

Os critérios de aceitação são a parte mais importante de uma feature. Eles devem descrever comportamento observável e verificável, não a estrutura interna da solução.

Exemplo inadequado:

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

Use Dado/Quando/Então quando isso tornar o cenário mais preciso, mas não force o formato em critérios simples.

## 3. Alteração Técnica

Use para:

- refatorações;
- infraestrutura;
- observabilidade;
- segurança;
- performance;
- dívida técnica;
- atualização de dependências;
- organização de repositórios;
- mudanças de deploy.

### Formato Do Título

```text
[ÁREA] Resultado técnico esperado
```

Exemplos:

```text
[INFRA] Versionar configurações do NGINX
[API] Separar os health checks de liveness e readiness
[AUTH] Centralizar a geração de tokens de verificação
[DATABASE] Reduzir o timeout de conexão com PostgreSQL
```

### Template

```md
## Contexto

Explique como o sistema funciona atualmente e por que essa alteração está
sendo considerada.

## Problema

Descreva a limitação, risco, duplicação, dificuldade operacional ou dívida
técnica existente.

## Objetivo técnico

Descreva qual resultado técnico deve existir após a conclusão da tarefa.

## Proposta

- Alteração principal que será realizada.
- Componentes ou configurações afetadas.
- Estratégia planejada para aplicação da mudança.

## Critérios de conclusão

- [ ] A alteração técnica foi implementada.
- [ ] O comportamento anterior necessário foi preservado.
- [ ] A mudança foi validada no ambiente adequado.
- [ ] A documentação necessária foi atualizada.
- [ ] Não foram adicionados segredos ou credenciais ao repositório.
- [ ] Existe uma forma conhecida de rollback, quando aplicável.

## Impactos e riscos

- Possíveis indisponibilidades.
- Compatibilidade com versões anteriores.
- Alterações em banco, variáveis de ambiente ou infraestrutura.
- Riscos de segurança ou perda de dados.

## Validação

Descreva como será possível comprovar que a alteração funcionou.

Exemplos:

1. Executar determinada ação.
2. Verificar logs ou resposta da aplicação.
3. Simular uma falha.
4. Confirmar o comportamento esperado.

## Rollback

Descreva como retornar ao estado anterior caso a alteração apresente problemas.

Preencher somente quando houver risco operacional relevante.
```

Obrigatório: `Contexto`, `Problema`, `Objetivo técnico`, `Proposta`, `Critérios de conclusão` e `Validação`.

Opcional: `Impactos e riscos` e `Rollback`.

## 4. Incidente

Use somente quando algo afetar produção, usuários, disponibilidade, segurança ou integridade dos dados.

### Formato Do Título

```text
[INCIDENTE] Resumo objetivo do ocorrido
```

Exemplos:

```text
[INCIDENTE] API indisponível após queda do PostgreSQL
[INCIDENTE] Certificado inválido bloqueou acesso à API
[INCIDENTE] Deploy iniciou aplicação sem variáveis obrigatórias
```

### Template

```md
## Resumo

Explique brevemente o que aconteceu.

## Impacto

- Funcionalidades afetadas.
- Usuários ou serviços afetados.
- Possível impacto em dados.
- Duração aproximada.

## Detecção

Explique como o problema foi descoberto, por exemplo por relato de usuário,
análise manual, health check, logs ou alerta de monitoramento.

## Linha do tempo

- `00:00` — Primeiro sinal do problema.
- `00:00` — Problema identificado.
- `00:00` — Ação de mitigação iniciada.
- `00:00` — Serviço normalizado.

## Causa

Explique a causa técnica conhecida. Caso ainda não esteja confirmada, registre
como hipótese e atualize depois.

## Resolução

Explique o que foi feito para normalizar o sistema.

## Ações preventivas

- [ ] Correção definitiva.
- [ ] Melhoria de monitoramento.
- [ ] Criação ou atualização de testes.
- [ ] Atualização da documentação.
- [ ] Revisão do processo de deploy ou rollback.

## Aprendizados

Registre o que esse incidente revelou sobre o sistema, arquitetura ou processo.
```

Um incidente pode originar issues separadas de bug ou alteração técnica para acompanhar correções permanentes.

## 5. Tarefa Simples

Nem todo trabalho precisa de um template grande. Para tarefas pequenas, use uma issue em branco com:

```md
## Objetivo

Descreva o que precisa ser feito.

## Critérios de conclusão

- [ ] Resultado esperado.
- [ ] Validação realizada.
```

Exemplos de título:

```text
[DOCS] Documentar variáveis de ambiente do NGINX
[API] Remover configuração obsoleta do TypeORM
[INFRA] Adicionar script para executar nginx -t
```

## Revisão Antes De Publicar

- O tipo escolhido representa o resultado principal?
- O título informa área e resultado sem repetir o tipo?
- O problema está descrito antes da solução?
- Os critérios são observáveis e verificáveis?
- As seções opcionais vazias foram removidas?
- Hipóteses estão identificadas como hipóteses?
- Possíveis duplicatas foram verificadas?
- O conteúdo está livre de segredos e dados sensíveis?
