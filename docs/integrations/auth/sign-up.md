# 📝 POST /auth/sign-up

## 📋 Descrição

Cria uma nova conta de usuário com email e senha. Retorna um access token JWT no body da resposta e define um refresh token em um cookie HttpOnly seguro.

## 🔐 Autenticação

❌ Não requer autenticação

## ⚡ Rate Limiting

- **Limite**: 10 requisições a cada 10 minutos
- **Bloqueio**: 30 minutos após exceder o limite
- **Header de resposta**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## 📨 Request

### Método e URL
```
POST /auth/sign-up
```

### Headers
```
Content-Type: application/json
```

### Body Parameters

| Campo | Tipo | Obrigatório | Validação | Descrição |
|-------|------|-------------|-----------|-----------|
| `userName` | string | ✅ Sim | 3-50 caracteres | Nome de usuário único (lowercase automático) |
| `email` | string | ✅ Sim | Email válido | Endereço de email (lowercase automático) |
| `password` | string | ✅ Sim | 6-50 caracteres | Senha do usuário |
| `firstName` | string | ❌ Não | 2-255 caracteres | Primeiro nome do usuário |
| `lastName` | string | ❌ Não | 2-255 caracteres | Sobrenome do usuário |

### Exemplo de Body
```json
{
  "userName": "john_doe",
  "email": "joao.silva@email.com",
  "password": "senhaSegura123",
  "firstName": "João",
  "lastName": "Silva"
}
```

## ✅ Response de Sucesso

### Status Code
```
201 Created
```

### Headers
```
Set-Cookie: refreshToken=<jwt_token>; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=604800
Content-Type: application/json
```

### Body
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
}
```

### Cookie Details
```
Nome: refreshToken
Valor: <JWT token>
Path: /auth
HttpOnly: true (JavaScript não pode acessar)
Secure: true (apenas HTTPS em produção)
SameSite: Lax (proteção CSRF)
Max-Age: 604800 (7 dias)
```

## ❌ Possíveis Erros

### 400 Bad Request
**Quando ocorre**: Dados de registro inválidos (validação falhou)

**Exemplo de cenários**:
- Username muito curto (< 3 caracteres)
- Email inválido
- Senha muito curta (< 6 caracteres)
- Campos obrigatórios ausentes

```json
{
  "statusCode": 400,
  "message": [
    "Username must be between 3 and 50 characters long.",
    "This email address is not a valid address.",
    "The password must be between 6 and 50 characters long."
  ],
  "error": "Bad Request"
}
```

### 409 Conflict
**Quando ocorre**: Email ou username já cadastrado

```json
{
  "statusCode": 409,
  "message": "Email already registered",
  "error": "Conflict"
}
```

ou

```json
{
  "statusCode": 409,
  "message": "Username already taken",
  "error": "Conflict"
}
```

### 422 Unprocessable Entity
**Quando ocorre**: Dados em formato correto mas semanticamente inválidos

```json
{
  "statusCode": 422,
  "message": "Unable to process the request",
  "error": "Unprocessable Entity"
}
```

### 429 Too Many Requests
**Quando ocorre**: Rate limit excedido

```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests",
  "error": "Too Many Requests"
}
```

**Headers da resposta**:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1640000000
Retry-After: 600
```

### 500 Internal Server Error
**Quando ocorre**: Erro interno do servidor

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

## 💡 Exemplos de Uso

### cURL
```bash
curl -X POST http://localhost:3000/auth/sign-up \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "userName": "john_doe",
    "email": "joao.silva@email.com",
    "password": "senhaSegura123",
    "firstName": "João",
    "lastName": "Silva"
  }'
```

**Resposta**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### JavaScript (fetch)
```javascript
async function signUp(userData) {
  try {
    const response = await fetch('http://localhost:3000/auth/sign-up', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Importante para enviar/receber cookies
      body: JSON.stringify({
        userName: 'john_doe',
        email: 'joao.silva@email.com',
        password: 'senhaSegura123',
        firstName: 'João',
        lastName: 'Silva'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    const data = await response.json();
    
    // Armazenar access token (localStorage, sessionStorage, ou estado da aplicação)
    localStorage.setItem('accessToken', data.accessToken);
    
    console.log('Conta criada com sucesso!');
    return data;
    
  } catch (error) {
    console.error('Erro ao criar conta:', error.message);
    throw error;
  }
}

// Uso
signUp();
```

### TypeScript (axios)
```typescript
import axios, { AxiosError } from 'axios';

interface SignUpRequest {
  userName: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

interface SignUpResponse {
  accessToken: string;
}

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
}

async function signUp(userData: SignUpRequest): Promise<SignUpResponse> {
  try {
    const response = await axios.post<SignUpResponse>(
      'http://localhost:3000/auth/sign-up',
      userData,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        withCredentials: true, // Importante para enviar/receber cookies
      }
    );

    // Armazenar access token
    localStorage.setItem('accessToken', response.data.accessToken);
    
    return response.data;
    
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ErrorResponse>;
      
      if (axiosError.response) {
        const { statusCode, message } = axiosError.response.data;
        
        switch (statusCode) {
          case 400:
            console.error('Dados inválidos:', message);
            break;
          case 409:
            console.error('Email ou username já cadastrado:', message);
            break;
          case 429:
            console.error('Muitas tentativas. Aguarde alguns minutos.');
            break;
          default:
            console.error('Erro ao criar conta:', message);
        }
      }
    }
    
    throw error;
  }
}

// Uso
const userData: SignUpRequest = {
  userName: 'john_doe',
  email: 'joao.silva@email.com',
  password: 'senhaSegura123',
  firstName: 'João',
  lastName: 'Silva'
};

signUp(userData)
  .then(data => console.log('Conta criada!', data))
  .catch(error => console.error('Falha:', error));
```

## 🔒 Notas de Segurança

1. **Senha**: Armazenada com hash bcrypt (custo 10). NUNCA armazenada em texto plano.

2. **Refresh Token**: 
   - Armazenado em cookie HttpOnly (JavaScript não consegue acessar)
   - Apenas enviado em requisições para `/auth/*`
   - Expira em 7 dias
   - Implementa rotação automática no refresh

3. **Access Token**:
   - Deve ser armazenado no lado do cliente (localStorage, sessionStorage ou memória)
   - Expira em 15 minutos
   - Enviado no header `Authorization: Bearer <token>`

4. **Rate Limiting**:
   - Previne ataques de força bruta
   - Bloqueia IP por 30 minutos após 10 tentativas em 10 minutos

5. **Validação**:
   - Email e username são convertidos para lowercase automaticamente
   - Campos são trimados (espaços removidos)
   - Validação forte de formato de email

## 📝 Próximos Passos

Após criar a conta:

1. Use o `accessToken` retornado para fazer requisições autenticadas
2. O `refreshToken` no cookie será usado automaticamente para renovar tokens
3. Teste com [`GET /users/me`](./get-me.md) para obter dados do usuário
4. Configure interceptor para [renovar tokens](./refresh-tokens.md) quando expirar

## 🔗 Endpoints Relacionados

- [`POST /auth/sign-in`](./sign-in.md) - Login com credenciais existentes
- [`GET /users/me`](./get-me.md) - Obter dados do usuário autenticado
- [`POST /auth/refresh`](./refresh-tokens.md) - Renovar access token
- [`POST /auth/logout`](./logout.md) - Encerrar sessão
