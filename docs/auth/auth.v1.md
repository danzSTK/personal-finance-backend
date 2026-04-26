Está versão está desatualizada e a complementação dela é a [[auth.v2]]
# Authentication & Session Management

## 1. Objetivo

Este módulo é responsável pela autenticação de usuários, controle de sessão, emissão e invalidação de tokens JWT e login social via Google OAuth. O sistema foi projetado para ser **stateful via Redis**, garantindo que sessões possam ser revogadas individualmente ou em massa, sem depender exclusivamente da expiração natural dos tokens.

> **Status atual:** em beta funcional. O módulo está operacional para os dois provedores suportados (credenciais e Google), com algumas melhorias planejadas documentadas ao longo deste arquivo.

---

## 2. Provedores de Autenticação

O sistema utiliza o conceito de **AuthProvider** para desacoplar a identidade do usuário do método de login utilizado.

Um usuário pode ter múltiplos provedores ativos simultaneamente — por exemplo, um mesmo usuário pode se autenticar via e-mail/senha **e** via Google. O que não é permitido é ter dois provedores do mesmo tipo para o mesmo usuário (dois logins Google, dois logins por credenciais etc.).

Os provedores suportados atualmente são:

| Provedor | Descrição |
|---|---|
| `EMAIL` | Login com e-mail e senha (credenciais) |
| `GOOGLE` | Login social via Google OAuth 2.0 |

> Outros provedores (como Apple) estão planejados, mas sem previsão de implementação.

---

## 3. Estratégia de Tokens

O sistema adota um modelo **híbrido** — tokens JWT para transporte de identidade, com controle de estado gerenciado pelo Redis.

### Access Token
- Vida útil **curta** (minutos).
- Carrega o payload mínimo: `sub` (user id), `email`, `status`, `jti` (ID único do token).
- Assinado com o **access secret**.
- **Não é armazenado no servidor.** A validade é verificada pela assinatura + blacklist.

### Refresh Token
- Vida útil **longa**.
- Assinado com um **secret diferente** do access token (isolamento de segurança).
- **É armazenado no Redis**, vinculado ao `userId` e ao seu próprio `jti`.
- Junto ao refresh token no Redis fica o **metadata da sessão** (dispositivo, IP, User-Agent, geolocalização).
- A existência do refresh token no Redis é o que define se uma sessão está ativa.

### Sessão
- Cada sessão é identificada pelo `jti` do refresh token.
- O Redis mantém um `Set` por usuário com todos os `jtis` de sessões ativas.
- Isso permite listar, revogar individualmente ou invalidar **todas as sessões** de um usuário de uma só vez.

---

## 4. Fluxo de Cadastro (Credenciais)

O cadastro via e-mail/senha segue a seguinte lógica:

```
Cliente → POST /auth/register (email, senha, nome, userName)
  │
  ├─ Verifica se já existe um AuthProvider EMAIL com este e-mail
  │    └─ Se sim → Conflito (e-mail já cadastrado com credenciais)
  │
  └─ Inicia transação atômica (banco de dados)
       │
       ├─ Busca usuário pelo e-mail
       │    │
       │    ├─ Usuário encontrado (ex: já tem conta Google)
       │    │    └─ Cria AuthProvider EMAIL e vincula ao usuário existente
       │    │         └─ Retorna usuário
       │    │
       │    └─ Usuário não encontrado
       │         ├─ Verifica se o userName já está em uso
       │         │    └─ Se sim → Conflito (userName já registrado)
       │         │
       │         ├─ Cria novo usuário com status ACTIVE
       │         └─ Cria AuthProvider EMAIL vinculado ao novo usuário
       │
       └─ Transação confirmada → Gera tokens → Retorna ao cliente
```

**Por que `ACTIVE` e não `PENDING_PROFILE`?**
No cadastro por credenciais temos **100% de certeza** de que o usuário forneceu todas as informações mínimas necessárias (nome, e-mail, userName, senha). Não há necessidade de um estado pendente.

> **Nota:** O Google pode ocasionalmente não retornar e-mail no payload OAuth. Por isso, a `GoogleStrategy` rejeita o fluxo imediatamente caso o e-mail não esteja presente — e-mail é um identificador obrigatório tanto na entidade `User` (`NOT NULL`) quanto no sistema de autenticação.

---

## 5. Fluxo de Login (Credenciais)

```
Cliente → POST /auth/signin (email, senha)
  │
  ├─ Guard intercepta a requisição antes de chegar ao controller
  │
  ├─ Strategy valida credenciais:
  │    ├─ Busca AuthProvider do tipo EMAIL com o e-mail informado
  │    ├─ Verifica se o hash de senha confere
  │    ├─ Busca o usuário vinculado ao provider
  │    ├─ Verifica se o usuário não está com status BLOCKED
  │    └─ Retorna o usuário (ou null em qualquer falha)
  │
  ├─ Usuário atrelado à requisição pelo Passport
  │
  └─ Gera tokens → Retorna ao cliente
```

> As validações de credenciais retornam `null` em vez de lançar exceções. Isso é intencional: evita enumerar informações ao cliente (não revela se o e-mail existe ou se a senha é a errada — retorna apenas "credenciais inválidas").

---

## 6. Fluxo de Login com Google

```
Cliente → GET /auth/google
  │
  └─ Guard redireciona para consentimento Google OAuth
       │
       └─ Google redireciona para GET /auth/google/callback
            │
            ├─ Passport intercepta e processa o callback OAuth
            │    └─ Fornece: accessToken Google, Profile, done()
            │
            ├─ Verifica se o Google retornou e-mail no perfil
            │    └─ Se não → Erro (e-mail é identificador obrigatório)
            │
            ├─ Verifica se já existe AuthProvider GOOGLE com o googleId
            │    └─ Se sim → Recupera usuário vinculado → Retorna
            │
            └─ Transação atômica:
                 ├─ Busca usuário pelo e-mail
                 │    ├─ Encontrado → vincula AuthProvider GOOGLE ao usuário existente
                 │    └─ Não encontrado → cria novo usuário + AuthProvider GOOGLE
                 │
                 └─ Gera tokens da API → Redireciona ao frontend com tokens
```

**Ponto importante:** O Google **não substitui** o sistema de tokens da aplicação. Após a autenticação OAuth, o Google confirma a identidade do usuário, mas todos os tokens utilizados pela aplicação (access e refresh) são gerados **internamente**. O token do Google é descartado após a validação.

---

## 7. Geração de Tokens e Persistência de Sessão

Sempre que um login ou cadastro é bem-sucedido, o sistema executa as seguintes operações **em paralelo** (Promise.all):

```
Para cada autenticação bem-sucedida:
  │
  ├─ Gera Access Token (JWT, secret A, expiração curta)
  ├─ Gera Refresh Token (JWT, secret B, expiração longa)
  │
  ├─ Persiste no Redis:
  │    ├─ Chave do Refresh Token → valor: metadata da sessão (JSON)
  │    │    (TTL = tempo de expiração do refresh token)
  │    │
  │    └─ Set de sessões do usuário → adiciona jti do refresh token
  │         (TTL igual ao refresh token, estendido a cada novo login)
  │
  └─ Retorna { accessToken, refreshToken } ao controller
       └─ Controller injeta o refresh token em cookie HttpOnly
```

O **metadata da sessão** (IP, User-Agent, dispositivo, geolocalização) fica armazenado junto ao refresh token no Redis, não no JWT. Isso mantém o payload do token limpo e permite enriquecer os dados de sessão sem reemitir tokens.

---

## 8. Rotação de Tokens (Refresh)

```
Cliente → POST /auth/refresh (refresh token via cookie)
  │
  ├─ Valida assinatura do refresh token (secret B)
  ├─ Extrai userId e jti do payload
  │
  ├─ Busca chave do refresh token no Redis
  │    └─ Não encontrada → possível session hijacking
  │         └─ Invalida TODAS as sessões do usuário (proteção proativa)
  │              └─ Lança 401
  │
  ├─ Remove o refresh token antigo do Redis
  ├─ Remove o jti antigo do Set de sessões do usuário
  │
  └─ Gera novo par de tokens → persiste nova sessão → retorna ao cliente
```

> **Detecção de replay:** Se um refresh token já utilizado for apresentado novamente (o que indica roubo de token), o Redis não encontrará mais a chave (já foi deletada na rotação anterior). O sistema então **invalida todas as sessões ativas** do usuário como medida de proteção.

---

## 9. Logout e Invalidação de Sessão

```
Cliente → POST /auth/logout (access token + refresh token via cookie)
  │
  ├─ Extrai access token e refresh token dos cookies
  ├─ Valida que o refresh token existe e é uma string válida
  │    └─ Se não → loga aviso de tentativa suspeita → 401
  │
  ├─ Decodifica o access token para obter jti e tempo restante (exp)
  ├─ Calcula TTL restante do access token
  │
  └─ Executa em paralelo (Promise.all):
       ├─ Coloca o jti do access token na Blacklist (Redis, TTL = tempo restante)
       ├─ Remove o refresh token do Redis
       └─ Remove o jti do refresh token do Set de sessões do usuário
```

**Por que colocar o access token na blacklist?**
O access token tem vida curta, mas ainda pode ser válido por alguns minutos após o logout. Sem a blacklist, um token capturado antes do logout continuaria funcional até expirar. A blacklist garante invalidação **imediata**.

### Invalidação total de sessões

Em situações de segurança (ex: refresh token suspeito detectado), o sistema pode invalidar **todas as sessões** de um usuário de uma vez:

```
Busca todos os jtis no Set de sessões do usuário
  └─ Para cada jti:
       └─ Deleta chave de refresh token do Redis
  └─ Deleta o Set de sessões
```

---

## 10. Blacklist de Access Tokens

| Característica | Detalhe |
|---|---|
| **Quando é usada** | No logout explícito do usuário |
| **O que é armazenado** | `jti` do access token |
| **TTL** | Exatamente o tempo restante de vida do token (nunca zero — mínimo 1s) |
| **Verificação** | A cada requisição autenticada, o `jti` é verificado contra a blacklist |
| **Objetivo** | Invalidar imediatamente tokens ainda válidos após logout |

> O TTL igual ao tempo restante garante que a entrada da blacklist desapareça automaticamente quando o token já estaria expirado de qualquer forma — mantendo o Redis limpo sem cleanup manual.

---

## 11. Segurança e Decisões Arquiteturais

### Por que não JWT stateless puro?

JWT stateless não permite revogação. Um token emitido é válido até expirar. Se um usuário fizer logout, trocar a senha ou tiver a conta comprometida, todos os tokens em circulação permaneceriam funcionais. O Redis como camada de controle resolve isso.

### Por que refresh token no Redis e não no banco de dados?

Redis oferece TTL nativo, leitura em O(1) e é otimizado para operações de chave-valor de alta frequência. O banco de dados seria mais lento e adicionaria carga desnecessária em uma operação que ocorre em **toda requisição de refresh**.

### Por que secrets diferentes para access e refresh?

Isolamento de comprometimento. Se o secret do access token for exposto, o refresh token permanece seguro (e vice-versa). Um atacante com o secret de um não consegue forjar o outro.

### Por que access token de vida curta?

Minimizar a janela de exploração. Mesmo que um access token seja capturado, ele será inútil em minutos. A blacklist complementa isso para o caso de logout explícito.

### Por que session tracking?

Permite ao usuário visualizar sessões ativas, identificar dispositivos não reconhecidos e revogar sessões individualmente — sem precisar trocar a senha. Também fornece dados de auditoria (IP, dispositivo, localização aproximada) para detecção de anomalias.

### Por que o refresh token é entregue via cookie HttpOnly?

Cookies HttpOnly não são acessíveis via JavaScript, eliminando o risco de roubo por XSS. O plano é migrar o access token para o mesmo modelo em uma próxima iteração.
