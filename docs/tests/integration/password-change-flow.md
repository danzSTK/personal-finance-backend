# `password-change-flow.integration-spec.ts`

## Classificação e objetivo

- Arquivo: `api/test/password-change-flow.integration-spec.ts`.
- Categoria: integração de fluxo real.
- Objetivo: provar a persistência e o uso da nova credencial entre caso de uso,
  bcrypt, repositories, PostgreSQL e Redis.
- Fora de escopo: controller HTTP, BullMQ, worker, criação de `email_messages` e
  envio pela Brevo.

## Comportamentos comprovados

- a senha antiga autentica antes da alteração;
- o caso de uso real conclui a mudança;
- a senha antiga deixa de autenticar e a nova passa a autenticar;
- o hash persistido reconhece somente a senha nova;
- `credential_version` passa de 1 para 2;
- um fato `PASSWORD_CHANGED` é persistido;
- os três eventos esperados são gravados na outbox sem senha ou hash;
- a projeção Redis é reconstruída e a barreira pendente é removida;
- sessões anteriores são removidas;
- as strategies de access e refresh rejeitam payloads com a versão antiga.

## Composição

Componentes reais:

- `ChangeUserPasswordUseCase` e `ValidateCredentialsUseCase`;
- `CachedUserRepository`, `UserRepository` e invalidator Redis;
- `PasswordChangeEventRepository` e outbox;
- `BcryptHashService`;
- policy, loader, synchronizer e state store Redis;
- `RedisSessionRepository`;
- `JwtStrategy` e `JwtRefreshStrategy`;
- entidades, mappers e migrations TypeORM.

Não são mockados repositories, hash, cache, sessão ou policy. A configuração JWT
usa somente secrets e issuer sintéticos; tokens assinados não são necessários para
chamar o comportamento `validate` das strategies.

## Dependências de execução

| Dependência | Versão | Provisionamento | Obrigatória |
| ----------- | ------ | --------------- | ----------- |
| Node.js | 22 | ambiente local/runner | sim |
| Docker | compatível com Testcontainers | host/runner | sim |
| PostgreSQL | `16-alpine` | Testcontainers | sim |
| Redis | `7-alpine` | Testcontainers | sim |

- Rede externa da aplicação: nenhuma.
- Credenciais reais: nenhuma.
- Portas: efêmeras, retornadas pelo Testcontainers.
- Primeira execução pode precisar baixar as duas imagens.

Os containers são atribuídos sequencialmente para que uma falha no segundo
startup preserve o handle necessário para remover o primeiro.

## Isolamento e cleanup

Cada cenário cria usuário, provider, e-mail, JTI e senhas sintéticos próprios. O
Redis é limpo antes de cada cenário. O teardown fecha Redis e DataSource e remove
os dois containers, tolerando inicialização parcial.

O teste não usa `setTimeout`, dados de produção ou ordem entre cenários. As
asserções de credencial observam somente IDs/booleanos, e a inspeção da outbox
reduz a presença de conteúdo sensível a um booleano; falhas não imprimem hashes,
senhas ou JWTs.

## Execução

```bash
# Diagnóstico direcionado
npm run test:integration -- --runTestsByPath test/password-change-flow.integration-spec.ts

# Validação agregada obrigatória
npm run test:integration
```

Job de CI: `Integration tests`.

Uma falha `Could not find a working container runtime strategy` indica Docker
indisponível para o processo, não falha da regra de negócio.

## Evidência inicial

Em 13 de agosto de 2026:

- execução direcionada: 2 cenários aprovados em 14,455s de Jest;
- execução agregada final: 9 suítes e 36 testes aprovados;
- tempo agregado final do Jest: 60,979s;
- tempo total final medido: 68,47s;
- memória residente máxima final medida: 669.328 KiB;
- timeout do job de CI: 20 minutos.

Esses valores são baseline diagnóstico, não SLA. A pipeline não precisou mudar.

## Quando atualizar

Atualizar quando mudarem cenários, componentes reais, eventos esperados, imagens,
configuração, isolamento, cleanup, comando ou impacto na CI.
