# `link-email-provider-flow.integration-spec.ts`

## Classificação e objetivo

- Arquivo: `api/test/link-email-provider-flow.integration-spec.ts`
- Categoria: integração
- Objetivo: comprovar com PostgreSQL real que o vínculo usa `users.email`,
  habilita login local e serializa tentativas concorrentes.
- Fora de escopo: controller HTTP, Redis cache, Google OAuth e eventos.

## Comportamentos comprovados

- Conta Google-only recebe provider `EMAIL` com o e-mail principal persistido.
- A senha criada autentica pelo fluxo local real.
- E-mail e status do usuário permanecem inalterados.
- Duas tentativas concorrentes persistem uma linha; a perdedora recebe conflito
  funcional de provider já vinculado.

## Composição

- Componentes reais: PostgreSQL, migrations, `UserRepository`, bcrypt, caso de
  uso de vínculo e validação de credenciais.
- Componentes mockados: nenhum componente do fluxo exercitado.

## Dependências de execução

| Dependência | Versão                        | Provisionamento      | Obrigatória |
| ----------- | ----------------------------- | -------------------- | ----------- |
| PostgreSQL  | 16-alpine                     | Testcontainers       | sim         |
| Docker      | compatível com Testcontainers | host local/runner CI | sim         |

- Docker: obrigatório.
- Rede externa: somente para obter a imagem quando ausente.
- Credenciais reais: não; container usa credenciais efêmeras.
- Portas: efêmeras atribuídas pelo Testcontainers.

## Isolamento e cleanup

Cada execução cria banco descartável e usuários sintéticos com UUID. `afterAll`
encerra a conexão e remove o container mesmo sem compartilhar dados externos.

## Execução

```bash
# Diagnóstico direcionado
npx jest --config ./test/jest-integration.json --runInBand link-email-provider-flow.integration-spec.ts

# Validação agregada obrigatória
npm run test:integration
```

- Job de CI: `Integration tests`.
- Falhas de ambiente conhecidas: Docker indisponível ou download da imagem
  bloqueado.

## Quando atualizar

Atualizar esta página quando mudarem fluxo de vínculo/login, lock, schema,
migrations, bcrypt, dependências, timeout ou cleanup.
