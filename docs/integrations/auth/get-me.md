# 👤 GET /auth/me

## 📋 Descrição

Retorna os dados do usuário autenticado a partir do access token JWT fornecido. Útil para obter informações do perfil do usuário logado e verificar se o token ainda é válido.

## 🔐 Autenticação

✅ **Requer autenticação** via Bearer Token

```
Authorization: Bearer <access_token>
```

## ⚡ Rate Limiting

❌ Não possui rate limiting específico (usa configuração global)

## 📨 Request

### Método e URL
```
GET /auth/me
```

### Headers
```
Authorization: Bearer <access_token>
```

### Body
Não requer body.

### Query Parameters
Não possui query parameters.

## ✅ Response de Sucesso

### Status Code
```
200 OK
```

### Headers
```
Content-Type: application/json
```

### Body
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userName": "john_doe",
  "email": "joao.silva@email.com",
  "firstName": "João",
  "lastName": "Silva",
  "status": "active",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### Response Fields

| Campo | Tipo | Nullable | Descrição |
|-------|------|----------|-----------|
| `id` | string (UUID) | Não | ID único do usuário |
| `userName` | string | Sim | Nome de usuário único |
| `email` | string | Não | Email do usuário |
| `firstName` | string | Sim | Primeiro nome |
| `lastName` | string | Sim | Sobrenome |
| `status` | string | Não | Status da conta (`active`, `inactive`, `banned`) |
| `createdAt` | string (ISO 8601) | Não | Data de criação da conta |
| `updatedAt` | string (ISO 8601) | Não | Data da última atualização |

## ❌ Possíveis Erros

### 401 Unauthorized
**Quando ocorre**: Token ausente, inválido ou expirado

**Cenário 1: Token não fornecido**
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

**Cenário 2: Token inválido**
```json
{
  "statusCode": 401,
  "message": "Invalid token",
  "error": "Unauthorized"
}
```

**Cenário 3: Token expirado**
```json
{
  "statusCode": 401,
  "message": "Token expired",
  "error": "Unauthorized"
}
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
# Com token armazenado em variável
ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Resposta**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userName": "john_doe",
  "email": "joao.silva@email.com",
  "firstName": "João",
  "lastName": "Silva",
  "status": "active",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### JavaScript (fetch)
```javascript
async function getCurrentUser() {
  try {
    const accessToken = localStorage.getItem('accessToken');
    
    if (!accessToken) {
      throw new Error('Usuário não autenticado');
    }

    const response = await fetch('http://localhost:3000/auth/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expirado - tentar refresh
        throw new Error('Token expirado');
      }
      throw new Error('Erro ao buscar dados do usuário');
    }

    const user = await response.json();
    console.log('Usuário logado:', user);
    return user;
    
  } catch (error) {
    console.error('Erro:', error.message);
    throw error;
  }
}

// Uso
getCurrentUser()
  .then(user => {
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Nome completo:', `${user.firstName} ${user.lastName}`);
  })
  .catch(error => {
    // Redirecionar para login se não autenticado
    window.location.href = '/login';
  });
```

### TypeScript (axios)
```typescript
import axios, { AxiosError } from 'axios';

interface User {
  id: string;
  userName: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: 'active' | 'inactive' | 'banned';
  createdAt: string;
  updatedAt: string;
}

interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
}

async function getCurrentUser(): Promise<User> {
  try {
    const accessToken = localStorage.getItem('accessToken');
    
    if (!accessToken) {
      throw new Error('Token não encontrado');
    }

    const response = await axios.get<User>(
      'http://localhost:3000/auth/me',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    return response.data;
    
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ErrorResponse>;
      
      if (axiosError.response?.status === 401) {
        // Token expirado ou inválido
        // Tentar refresh ou redirecionar para login
        throw new Error('Sessão expirada');
      }
    }
    
    throw new Error('Erro ao buscar dados do usuário');
  }
}

// Uso
getCurrentUser()
  .then(user => {
    console.log('Usuário:', user);
    // Atualizar estado da aplicação com dados do usuário
  })
  .catch(error => {
    console.error('Erro:', error.message);
    // Redirecionar para login
  });
```

### React Hook com Auto-Refresh
```typescript
import { useState, useEffect } from 'react';
import axios from 'axios';

interface User {
  id: string;
  userName: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const accessToken = localStorage.getItem('accessToken');
      
      const response = await axios.get<User>(
        'http://localhost:3000/auth/me',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      setUser(response.data);
      setError(null);
    } catch (err: any) {
      if (err.response?.status === 401) {
        // Tentar refresh
        try {
          const refreshResponse = await axios.post(
            'http://localhost:3000/auth/refresh',
            {},
            { withCredentials: true }
          );
          
          localStorage.setItem('accessToken', refreshResponse.data.accessToken);
          
          // Tentar buscar usuário novamente
          return fetchUser();
        } catch (refreshError) {
          setError('Sessão expirada');
          // Redirecionar para login
          window.location.href = '/login';
        }
      } else {
        setError('Erro ao buscar dados do usuário');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return { user, loading, error, refetch: fetchUser };
}

// Uso no componente
function UserProfile() {
  const { user, loading, error } = useCurrentUser();

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error}</div>;
  if (!user) return null;

  return (
    <div>
      <h1>Perfil</h1>
      <p>Nome: {user.firstName} {user.lastName}</p>
      <p>Email: {user.email}</p>
      <p>Username: {user.userName}</p>
      <p>Status: {user.status}</p>
    </div>
  );
}
```

### Axios Interceptor (Configuração Global)
```typescript
import axios from 'axios';

// Criar instância do axios
const api = axios.create({
  baseURL: 'http://localhost:3000',
  withCredentials: true,
});

// Interceptor para adicionar token automaticamente
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para renovar token expirado
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Se erro 401 e não é retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Tentar renovar token
        const response = await api.post('/auth/refresh');
        const { accessToken } = response.data;
        
        localStorage.setItem('accessToken', accessToken);
        
        // Atualizar header e repetir requisição original
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh falhou - redirecionar para login
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Agora usar api ao invés de axios diretamente
export async function getCurrentUser() {
  const response = await api.get('/auth/me');
  return response.data;
}
```

## 🔒 Notas de Segurança

1. **Token JWT**:
   - Access token expira em 15 minutos
   - Assinado com HS256
   - Contém apenas informações não sensíveis (userId, email)

2. **Validação**:
   - Token verificado em cada requisição
   - Assinatura validada
   - Expiração verificada

3. **Boas Práticas**:
   - Armazene access token em localStorage ou sessionStorage
   - NUNCA envie token via URL ou query parameters
   - Configure CORS adequadamente
   - Use HTTPS em produção

## 💡 Casos de Uso Comuns

### 1. Verificar se usuário está autenticado
```typescript
async function isAuthenticated(): Promise<boolean> {
  try {
    await getCurrentUser();
    return true;
  } catch {
    return false;
  }
}
```

### 2. Protected Route (React)
```typescript
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useCurrentUser();

  if (loading) return <div>Carregando...</div>;
  if (!user) {
    window.location.href = '/login';
    return null;
  }

  return <>{children}</>;
}
```

### 3. Exibir nome do usuário no header
```typescript
function Header() {
  const { user } = useCurrentUser();

  return (
    <header>
      <h1>Personal Finance</h1>
      {user && (
        <div>
          Olá, {user.firstName || user.userName || user.email}
        </div>
      )}
    </header>
  );
}
```

## 📝 Dicas

1. **Cache**: Considere cachear os dados do usuário para evitar requisições desnecessárias
2. **Auto-Refresh**: Configure interceptor para renovar token automaticamente ao expirar
3. **Validação**: Use este endpoint para validar se o usuário ainda está autenticado
4. **Loading State**: Sempre mostre feedback de carregamento durante a requisição

## 🔗 Endpoints Relacionados

- [`POST /auth/sign-in`](./sign-in.md) - Fazer login
- [`POST /auth/sign-up`](./sign-up.md) - Criar conta
- [`POST /auth/refresh`](./refresh-tokens.md) - Renovar access token
- [`POST /auth/logout`](./logout.md) - Encerrar sessão
- [`GET /auth/sessions`](./sessions.md) - Ver sessões ativas
