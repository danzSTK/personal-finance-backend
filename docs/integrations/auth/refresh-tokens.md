# 🔄 POST /auth/refresh

## 📋 Descrição

Renova o access token usando o refresh token armazenado no cookie HttpOnly. Implementa **refresh token rotation** para segurança máxima: o refresh token antigo é invalidado e um novo é gerado.

## 🔐 Autenticação

✅ **Requer refresh token** via cookie HttpOnly

O refresh token é enviado automaticamente pelo navegador através do cookie `refreshToken`.

## ⚡ Rate Limiting

- **Limite**: 5 requisições por minuto
- **Bloqueio**: Temporário após exceder o limite
- **Header de resposta**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`

## 📨 Request

### Método e URL
```
POST /auth/refresh
```

### Headers
Não requer headers especiais. O cookie `refreshToken` é enviado automaticamente.

### Cookies (automático)
```
refreshToken=<jwt_refresh_token>
```

### Body
Não requer body.

## ✅ Response de Sucesso

### Status Code
```
200 OK
```

### Headers
```
Set-Cookie: refreshToken=<new_jwt_token>; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=604800
Content-Type: application/json
```

### Body
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJlbWFpbCI6ImpvYW8uc2lsdmFAZW1haWwuY29tIiwiaWF0IjoxNzA1MzIwMDAwLCJleHAiOjE3MDUzMjA5MDB9.abc123"
}
```

### Cookie Details
```
Nome: refreshToken (novo token)
Valor: <JWT token>
Path: /auth
HttpOnly: true
Secure: true (produção)
SameSite: Lax
Max-Age: 604800 (7 dias)
```

## ❌ Possíveis Erros

### 401 Unauthorized
**Quando ocorre**: Refresh token ausente, inválido, expirado ou já utilizado

**Cenário 1: Cookie não fornecido**
```json
{
  "statusCode": 401,
  "message": "Refresh token not found",
  "error": "Unauthorized"
}
```

**Cenário 2: Refresh token inválido**
```json
{
  "statusCode": 401,
  "message": "Invalid refresh token",
  "error": "Unauthorized"
}
```

**Cenário 3: Refresh token expirado**
```json
{
  "statusCode": 401,
  "message": "Refresh token expired",
  "error": "Unauthorized"
}
```

**Cenário 4: Refresh token já usado (reuso detectado)**
```json
{
  "statusCode": 401,
  "message": "Token reuse detected",
  "error": "Unauthorized"
}
```

> ⚠️ **Importante**: Se token reuse for detectado, TODAS as sessões do usuário podem ser invalidadas por segurança.

### 429 Too Many Requests
**Quando ocorre**: Rate limit excedido

```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests",
  "error": "Too Many Requests"
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
# O cookie refreshToken precisa estar salvo em cookies.txt
curl -X POST http://localhost:3000/auth/refresh \
  -b cookies.txt \
  -c cookies.txt
```

**Resposta**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### JavaScript (fetch)
```javascript
async function refreshAccessToken() {
  try {
    const response = await fetch('http://localhost:3000/auth/refresh', {
      method: 'POST',
      credentials: 'include', // CRUCIAL: Envia cookies automaticamente
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Refresh token inválido/expirado - redirecionar para login
        throw new Error('Sessão expirada');
      }
      throw new Error('Erro ao renovar token');
    }

    const data = await response.json();
    
    // Atualizar access token armazenado
    localStorage.setItem('accessToken', data.accessToken);
    
    console.log('Token renovado com sucesso!');
    return data.accessToken;
    
  } catch (error) {
    console.error('Erro ao renovar token:', error.message);
    
    // Limpar token antigo e redirecionar
    localStorage.removeItem('accessToken');
    window.location.href = '/login';
    
    throw error;
  }
}

// Uso
refreshAccessToken()
  .then(newToken => {
    console.log('Novo access token:', newToken);
  });
```

### TypeScript (axios)
```typescript
import axios, { AxiosError } from 'axios';

interface RefreshResponse {
  accessToken: string;
}

interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
}

async function refreshAccessToken(): Promise<string> {
  try {
    const response = await axios.post<RefreshResponse>(
      'http://localhost:3000/auth/refresh',
      {}, // Body vazio
      {
        withCredentials: true, // CRUCIAL: Envia cookies
      }
    );

    const { accessToken } = response.data;
    
    // Atualizar token armazenado
    localStorage.setItem('accessToken', accessToken);
    
    return accessToken;
    
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ErrorResponse>;
      
      if (axiosError.response?.status === 401) {
        // Sessão expirada - fazer logout
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        throw new Error('Sessão expirada. Faça login novamente.');
      }
    }
    
    throw new Error('Erro ao renovar token');
  }
}

// Uso
refreshAccessToken()
  .then(token => console.log('Token renovado'))
  .catch(error => console.error(error.message));
```

### Axios Interceptor (Auto-Refresh)
```typescript
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Criar instância do axios
const api = axios.create({
  baseURL: 'http://localhost:3000',
  withCredentials: true, // Importante para cookies
});

// Flag para evitar loops infinitos
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any = null, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// Request interceptor: adicionar token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: auto-refresh em 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Se erro 401 e não é retry e não é o próprio endpoint de refresh
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== '/auth/refresh'
    ) {
      if (isRefreshing) {
        // Já está renovando, adicionar à fila
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Renovar token
        const response = await api.post('/auth/refresh');
        const { accessToken } = response.data;
        
        localStorage.setItem('accessToken', accessToken);
        
        // Processar fila de requisições pendentes
        processQueue(null, accessToken);
        
        // Atualizar header da requisição original
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh falhou - fazer logout
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// Uso em qualquer lugar da aplicação
import api from './api';

async function getUserData() {
  // Token expirado? Será renovado automaticamente!
  const response = await api.get('/users/me');
  return response.data;
}
```

### React Hook com Auto-Refresh
```typescript
import { useEffect, useCallback } from 'react';
import axios from 'axios';

export function useTokenRefresh() {
  const refreshToken = useCallback(async () => {
    try {
      const response = await axios.post(
        'http://localhost:3000/auth/refresh',
        {},
        { withCredentials: true }
      );
      
      localStorage.setItem('accessToken', response.data.accessToken);
      return response.data.accessToken;
    } catch (error) {
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
      throw error;
    }
  }, []);

  // Renovar automaticamente antes de expirar (13 minutos)
  useEffect(() => {
    const interval = setInterval(() => {
      refreshToken();
    }, 13 * 60 * 1000); // 13 minutos

    return () => clearInterval(interval);
  }, [refreshToken]);

  return { refreshToken };
}

// Uso no App
function App() {
  useTokenRefresh(); // Renova automaticamente a cada 13 minutos

  return <YourApp />;
}
```

## 🔒 Refresh Token Rotation

### Como funciona?

1. **Requisição inicial**: Cliente envia refresh token via cookie
2. **Validação**: Servidor valida o refresh token
3. **Geração**: Servidor gera NOVOS access e refresh tokens
4. **Invalidação**: Refresh token antigo é INVALIDADO
5. **Resposta**: Novo access token no body + novo refresh token no cookie

### Por que é seguro?

- ✅ **Refresh token só pode ser usado uma vez**
- ✅ **Detecta roubo de token** (se token antigo for usado novamente)
- ✅ **Janela de ataque reduzida** (token antigo invalida imediatamente)
- ✅ **Cookie HttpOnly** (JavaScript não pode acessar)

### Detecção de Reuso

Se um refresh token já usado for apresentado novamente:

1. Sistema detecta tentativa de reuso
2. Todas as sessões do usuário podem ser invalidadas
3. Usuário precisa fazer login novamente
4. Logs de segurança são gerados

## 🔒 Notas de Segurança

1. **Armazenamento**:
   - ✅ Refresh token: Cookie HttpOnly (seguro)
   - ✅ Access token: localStorage ou sessionStorage
   - ❌ NUNCA armazene refresh token em localStorage

2. **Expiração**:
   - Access token: 15 minutos
   - Refresh token: 7 dias
   - Renove antes de expirar para melhor UX

3. **HTTPS**:
   - Cookie Secure ativo em produção
   - SEMPRE use HTTPS em produção
   - Em desenvolvimento: HTTP permitido

4. **CORS**:
   - Configure `credentials: 'include'` ou `withCredentials: true`
   - Backend deve permitir credenciais
   - Frontend e backend devem estar nas origens permitidas

## 💡 Boas Práticas

1. **Renovação Proativa**:
   ```typescript
   // Renovar 2 minutos antes de expirar
   setTimeout(refreshToken, 13 * 60 * 1000);
   ```

2. **Interceptor Global**:
   - Configure interceptor para renovar automaticamente
   - Evita código duplicado em cada requisição

3. **Tratamento de Erros**:
   - 401 no refresh = logout automático
   - Limpe estado da aplicação
   - Redirecione para login

4. **Fila de Requisições**:
   - Evite múltiplos refreshes simultâneos
   - Use fila para requisições pendentes

## 📝 Troubleshooting

### Cookie não está sendo enviado
- ✅ Verifique `credentials: 'include'` ou `withCredentials: true`
- ✅ Verifique configuração CORS no backend
- ✅ Verifique se domínio/porta estão corretos

### Erro "Token reuse detected"
- Sistema detectou tentativa de reuso de token
- Faça login novamente
- Verifique se não há múltiplas abas renovando simultaneamente

### Loop infinito de refresh
- Verifique flag `_retry` no interceptor
- Verifique condição `url !== '/auth/refresh'`
- Verifique se isRefreshing está sendo resetado

## 🔗 Endpoints Relacionados

- [`POST /auth/sign-in`](./sign-in.md) - Obter tokens iniciais
- [`POST /auth/sign-up`](./sign-up.md) - Criar conta e obter tokens
- [`POST /auth/logout`](./logout.md) - Invalidar tokens
- [`GET /users/me`](./get-me.md) - Usar access token
- [`GET /auth/sessions`](./sessions.md) - Ver sessões ativas
