# Design — limite UTF-8 de senhas locais

## Fluxo proposto

```text
HTTP de criação/alteração
  -> decorator class-validator
       -> utilitário compartilhado
  -> use case
       -> IHashService
            -> utilitário compartilhado
            -> bcrypt somente quando <= 72 bytes

login
  -> LocalAuthGuard / LocalStrategy
       -> ValidateCredentialsUseCase
            -> IHashService.compare
                 -> utilitário compartilhado
       -> erro de limite convertido em 401 genérico
```

## Componentes

### Constante e utilitário

`USER_PASSWORD_MAX_UTF8_BYTES = 72` permanece junto das constantes compartilhadas
de senha. Um utilitário puro recebe uma string e retorna booleano usando
`Buffer.byteLength(value, 'utf8') <= USER_PASSWORD_MAX_UTF8_BYTES`.

O cálculo deve existir em um único lugar. DTOs, hashing e testes consomem essa
função em vez de repetir a matemática.

### Validação HTTP

Um decorator customizado do `class-validator` usa o utilitário compartilhado e
produz mensagem de campo sem ecoar o valor recebido. Ele será aplicado aos DTOs
cujos pipes realmente executam antes da criação ou alteração de credenciais:

- `RegisterDto.password`;
- `LinkEmailProviderDto.password`;
- `ChangeUserPasswordDto.currentPassword`;
- `ChangeUserPasswordDto.newPassword`.

O `LoginEmailDto` serve hoje como descrição Swagger, mas o `LocalAuthGuard`
executa antes dos pipes do controller. Portanto, o decorator nesse DTO não será
tratado como proteção do login. A garantia real do login pertence a
`IHashService.compare()` e à tradução segura feita pela `LocalStrategy`.

### Serviço de hash

`BcryptHashService.hash()` e `compare()` verificam o utilitário antes de chamar
`bcryptjs`. Se o limite for excedido, lançam
`PasswordByteLimitExceededError`, com código estável
`PASSWORD_BYTE_LIMIT_EXCEEDED` e sem incluir o valor ou tamanho recebido na
mensagem.

Esse comportamento pertence ao contrato de `IHashService`: nenhum consumidor
interno ou futuro pode causar truncamento mesmo sem DTO.

### Login

`ValidateCredentialsUseCase` continua usando `compare()`. A `LocalStrategy`
captura exclusivamente `PasswordByteLimitExceededError` e responde com a mesma
`UnauthorizedException('Invalid credentials')` já usada para falhas comuns.
Outros erros continuam sendo propagados, evitando ocultar indisponibilidade ou
falhas inesperadas.

Essa tradução impede o truncamento sem transformar o limite em um canal distinto
de autenticação. O login não precisa de validação manual com `Buffer` nem de um
novo guard.

### Erro e HTTP

O erro é framework-independent e compartilhado, pois pode nascer em qualquer
consumidor do serviço. O filtro global mapeia o código para `400` quando ele
escapa de fluxos de criação/alteração. Na borda normal, o decorator mantém
`VALIDATION_ERROR`; no login, a strategy mantém `401` genérico.

## Segurança

- Nunca truncar automaticamente.
- Nunca registrar entrada, prefixo, hash ou byte length específico do usuário.
- Não normalizar Unicode, porque isso alteraria o segredo escolhido.
- Rejeitar a comparação antes do bcrypt para impedir equivalência por prefixo.
- Manter defesa em profundidade: DTO para experiência de API e serviço para
  invariante do sistema.

## Dados e infraestrutura

Não há alteração de schema, migration, Redis, outbox, worker, configuração ou
pipeline. Não há nova dependência: Node fornece `Buffer` e o projeto já usa
`class-validator`.

## Testes

- Utilitário: vazio, ASCII, multibyte, emoji, 72 e 73 bytes.
- Decorator/DTOs: campos aceitos e rejeitados com Unicode multibyte.
- `BcryptHashService`: `hash()` e `compare()` não chamam bcrypt acima do limite.
- `LocalStrategy`: erro de limite vira `401`; erros desconhecidos propagam.
- Casos de uso/HTTP: cadastro, vínculo e alteração seguem o contrato de campo.
- Login: entrada acima do limite não autentica e não expõe código específico.

## Documentação

Atualizar Swagger e as integrações de cadastro, login, vínculo de provider e
alteração de senha. O OpenAPI continua declarando `maxLength: 50`, pois esse campo
mede caracteres; o limite de 72 bytes será descrito textualmente.
