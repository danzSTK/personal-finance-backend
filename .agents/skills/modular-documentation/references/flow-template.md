# Flow Template

Use este modelo para documentar fluxos de ciclo de vida, processos em background ou operações orquestradas dentro de `docs/<modulo>/flows/`.

```markdown
---
area: <modulo>
type: flow
status: current
related:
  - ../concepts/<conceito-relacionado>.md
  - ../decisions/<decisao-relacionada>.md
---

# <Nome do Fluxo no Imperativo ou Gerúndio>

Descrição em uma ou duas frases sobre o objetivo funcional do fluxo.

## Gatilho e Pré-condições

- **Gatilho:** O que dispara este fluxo (ex.: requisição HTTP DELETE, evento de outbox, agendador cron no Worker).
- **Pré-condições:** Estados necessários para que o fluxo seja aceito (ex.: usuário autenticado, transação com status PENDING).

## Passo a Passo Observável

Descreva as etapas em sequência numerada, focando em transições de estado observáveis e persistência:

1. O consumidor envia o comando com os parâmetros validados.
2. Uma transação PostgreSQL é iniciada e bloqueia a linha com lock pessimista (`FOR UPDATE`).
3. O estado muda para `<STATUS_INTERMEDIARIO>` e é persistido.
4. A operação externa idempotente é executada (ex.: chamada a Object Storage, envio de e-mail).
5. O estado final é consolidado como `<STATUS_FINAL>`.

## Idempotência e Repetição

Explique por que executar este fluxo duas vezes consecutivas não causa efeitos colaterais duplicados ou inconsistência:

- O que acontece se o mesmo evento for entregue duas vezes?
- O que acontece se a chamada externa já tiver sido realizada antes de uma falha de rede?

## Tratamento de Falhas e Casos de Borda

| Cenário de Falha | Comportamento do Sistema | Estado Resultante |
|:---|:---|:---|
| Timeout ou 5xx no serviço externo | Captura erro, incrementa tentativas no metadata e agenda retry | Mantém status intermediário |
| Objeto não encontrado no destino | Considera a remoção idempotente concluída com sucesso | Avança para o status final |
| Esgotamento do limite de retries | Move para quarentena e emite alerta estruturado de log | Status de falha / quarentena |
```
