# 🔑 POST /auth/sign-in

## 📋 Descrição

Autentica um usuário existente com email e senha. Retorna um access token JWT no body da resposta e define um refresh token em um cookie HttpOnly seguro.

## 🔐 Autenticação

❌ Não requer autenticação

## ⚡ Rate Limiting

- **Limite**: 5 requisições por minuto
- **Bloqueio**: 10 minutos após exceder o limite
- **Header de resposta**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## 📨 Request

### Método e URL
```
POST /auth/sign-in
```

### Headers
```
Content-Type: application/json
```

### Body Parameters

| Campo | Tipo | Obrigatório | Validação | Descrição |
|-------|------|-------------|-----------|-----------|
| `email` | string | ✅ Sim | Email válido | Endereço de email cadastrado |
| `password` | string | ✅ Sim | Não vazio | Senha do usuário |

### Exemplo de Body
```json
{
  "email": "joao.silva@email.com",
  "password": "senhaSegura123"
}
```

## ✅ Response de Sucesso

### Status Code
```
200 OK
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
**Quando ocorre**: Dados de login inválidos (validação falhou)

**Exemplo de cenários**:
- Email em formato inválido
- Campos obrigatórios ausentes
- Tipos de dados incorretos

```json
{
  "statusCode": 400,
  "message": [
    "Email must be a string",
    "Invalid email address",
    "Email is required",
    "Password must be a string",
    "Password is required"
  ],
  "error": "Bad Request"
}
```

### 401 Unauthorized
**Quando ocorre**: Credenciais incorretas (email não encontrado ou senha incorreta)

```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

**Importante**: Por segurança, a API não informa se o email existe ou se a senha está incorreta. Sempre retorna "Invalid credentials".

### 429 Too Many Requests
**Quando ocorre**: Rate limit excedido (mais de 5 tentativas em 1 minuto)

```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests",
  "error": "Too Many Requests"
}
```

**Headers da resposta**:
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1640000060
Retry-After: 60
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
curl -X POST http://localhost:3000/auth/sign-in \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "joao.silva@email.com",
    "password": "senhaSegura123"
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
async function signIn(email, password) {
  try {
    const response = await fetch('http://localhost:3000/auth/sign-in', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Importante para enviar/receber cookies
      body: JSON.stringify({
        email,
        password
      })
    });

    if (!response.ok) {
      const error = await response.json();
      
      if (response.status === 401) {
        throw new Error('Email ou senha incorretos');
      }
      
      if (response.status === 429) {
        throw new Error('Muitas tentativas. Aguarde alguns minutos.');
      }
      
      throw new Error(error.message || 'Erro ao fazer login');
    }

    const data = await response.json();
    
    // Armazenar access token
    localStorage.setItem('accessToken', data.accessToken);
    
    console.log('Login realizado com sucesso!');
    return data;
    
  } catch (error) {
    console.error('Erro ao fazer login:', error.message);
    throw error;
  }
}

// Uso
signIn('joao.silva@email.com', 'senhaSegura123')
  .then(data => {
    console.log('Logado!', data);
    // Redirecionar para dashboard, etc
  })
  .catch(error => {
    console.error('Falha no login:', error.message);
    // Mostrar mensagem de erro ao usuário
  });
```

### TypeScript (axios)
```typescript
import axios, { AxiosError } from 'axios';

interface SignInRequest {
  email: string;
  password: string;
}

interface SignInResponse {
  accessToken: string;
}

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
}

async function signIn(credentials: SignInRequest): Promise<SignInResponse> {
  try {
    const response = await axios.post<SignInResponse>(
      'http://localhost:3000/auth/sign-in',
      credentials,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        withCredentials: true, // Importante para enviar/receber cookies
      }
    );

    // Armazenar access token
    localStorage.setItem('accessToken', response.data.accessToken);
    
    console.log('Login realizado com sucesso!');
    return response.data;
    
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ErrorResponse>;
      
      if (axiosError.response) {
        const { statusCode, message } = axiosError.response.data;
        
        switch (statusCode) {
          case 400:
            throw new Error('Dados inválidos. Verifique email e senha.');
          case 401:
            throw new Error('Email ou senha incorretos.');
          case 429:
            throw new Error('Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.');
          default:
            throw new Error(Array.isArray(message) ? message.join(', ') : message);
        }
      }
    }
    
    throw new Error('Erro ao conectar com o servidor');
  }
}

// Uso
const credentials: SignInRequest = {
  email: 'joao.silva@email.com',
  password: 'senhaSegura123'
};

signIn(credentials)
  .then(data => {
    console.log('Access Token:', data.accessToken);
    // Redirecionar para dashboard
    window.location.href = '/dashboard';
  })
  .catch(error => {
    console.error('Erro:', error.message);
    // Exibir mensagem de erro na UI
  });
```

### React Hook Exemplo
```typescript
import { useState } from 'react';
import axios from 'axios';

interface LoginFormData {
  email: string;
  password: string;
}

export function useLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (data: LoginFormData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        'http://localhost:3000/auth/sign-in',
        data,
        { withCredentials: true }
      );

      localStorage.setItem('accessToken', response.data.accessToken);
      
      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Erro ao fazer login';
      setError(Array.isArray(errorMessage) ? errorMessage[0] : errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { login, loading, error };
}

// Uso no componente
function LoginForm() {
  const { login, loading, error } = useLogin();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      await login({
        email: formData.get('email') as string,
        password: formData.get('password') as string,
      });
      
      // Redirecionar após sucesso
      window.location.href = '/dashboard';
    } catch {
      // Erro já está no estado
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      
      <input type="email" name="email" required />
      <input type="password" name="password" required />
      
      <button type="submit" disabled={loading}>
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  );
}
```

## 🔒 Notas de Segurança

1. **Proteção contra força bruta**:
   - Rate limit de 5 tentativas por minuto
   - Bloqueio de 10 minutos após exceder
   - Proteção por IP

2. **Credenciais**:
   - Senha comparada usando bcrypt
   - Email convertido para lowercase antes da busca
   - Nunca retorna se email existe ou se senha está incorreta (sempre "Invalid credentials")

3. **Tokens**:
   - Access Token JWT com expiração de 15 minutos
   - Refresh Token em cookie HttpOnly com expiração de 7 dias
   - Implementa token rotation no refresh

4. **Sessões**:
   - Cada login cria uma nova sessão
   - Metadados salvos: IP, User-Agent, localização geográfica, timestamp
   - Usuário pode ter múltiplas sessões ativas simultaneamente

5. **Cookies**:
   - HttpOnly previne acesso via JavaScript (proteção XSS)
   - Secure em produção (apenas HTTPS)
   - SameSite=Lax (proteção CSRF)
   - Path=/auth (cookie só enviado em rotas de auth)

## 📝 Próximos Passos

Após fazer login:

1. Use o `accessToken` retornado em todas as requisições autenticadas
2. Configure interceptor para adicionar token automaticamente:
   ```typescript
   axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
   ```

3. Configure renovação automática quando token expirar:
   - Intercepte erros 401
   - Chame [`POST /auth/refresh`](./refresh-tokens.md)
   - Repita requisição original com novo token

4. Teste com [`GET /auth/me`](./get-me.md) para obter dados do usuário

## 🔗 Endpoints Relacionados

- [`POST /auth/sign-up`](./sign-up.md) - Criar nova conta
- [`GET /auth/me`](./get-me.md) - Obter dados do usuário autenticado
- [`POST /auth/refresh`](./refresh-tokens.md) - Renovar access token
- [`POST /auth/logout`](./logout.md) - Encerrar sessão
- [`GET /auth/sessions`](./sessions.md) - Listar sessões ativas
- [`GET /auth/google`](./oauth-google.md) - Login alternativo com Google
