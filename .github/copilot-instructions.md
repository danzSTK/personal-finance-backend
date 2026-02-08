When performing a code review, respond in Português.


# Instruções de Revisão de Código - Sistema de Finanças (Lead Developer Mode)

Sempre que realizar uma revisão de código, siga estas diretrizes:

## Idioma e Comunicação

* Responda obrigatoriamente em **Português**.
* Seja técnico e direto, mas construtivo (estilo Mentor).



## Regras de Negócio de Finançasa

* **Precisão:** Garanta o uso de `decimal.js` ou `big.js` para qualquer operação aritmética de saldos e valores. **Floats são proibidos** para dinheiro.
* **Integridade:** Toda transação deve possuir obrigatoriamente `userId`, `categoryId` e `date`.
* **Validação de Saldo:** Verifique se a lógica de "gastar" valida o saldo atual antes de persistir, retornando `400 Bad Request` se insuficiente.

## Arquitetura e Autenticação (Estado e Cache)

* **Redis Sync:** Verifique se operações de Logout ou Alteração de Senha estão a limpar corretamente os `jti` no Redis (Whitelist e Session Sets) e que o sistema está invalidando caches de users ou auth corretamente após essas ações que alteram seu objeto.

* **Cacheamento:** Confirme se endpoints de leitura intensiva (ex: listagem de transações, categorias) estão utilizando o `CACHE_MANAGER` para cachear respostas, com TTL apropriado (ex: 5 minutos).

* **Consistência:** As keys de busca como `user:{userId}:transactions` devem ser atualizadas ou invalidadas após operações de escrita (criação, atualização, deleção). Verifique se isso está sendo feito e se a possibilidades de erro por motivo de case-sensitivity estão sendo tratadas. Como um cache existe mas não é fonte de verdade, a consistência eventual deve ser garantida. Assegure que o código lida corretamente com possíveis leituras de dados desatualizados ou inconsistentes como o email que pode ou não existir em um usuário ou auth. Devemos sempra garantir a integridade dos dados.

* **Abstração:** Garanta que operações complexas de Redis usem o `REDIS_CLIENT` (ioredis) e operações de cache simples usem o `CACHE_MANAGER`.

* **Ownership:** Verifique se todos os repositórios/services filtram os dados pelo `userId` vindo do token. **Nunca confie em IDs enviados no corpo da requisição para recursos privados.**

## Padrões NestJS/TypeORM

* **TypeORM:** Verifique se as Entidades seguem o padrão definido e se novas colunas possuem migrações correspondentes.
* **Decoradores:** Incentive o uso de `@CurrentUser()` para acessar dados do utilizador logado.
* **Async:** Garanta que todas as operações de I/O (DB, Redis) estão devidamente "awaitadas".
* **DTOs:** Garanta que todos os campos do DTO possuem decorators do `class-validator` e `class-transformer`.

## Segurança

* **Exposição:** Verifique se campos sensíveis (hashes de senha, segredos) estão marcados com `{ select: false }` nas entidades ou sendo removidos na resposta.
* **Tratamento de Erros:** Não exponha erros internos da base de dados; use `InternalServerErrorException` ou exceptions específicas do Nest.
