# 🚪 POST /auth/logout

## 📋 Descrição

Encerra a sessão atual do usuário, invalidando tanto o access token quanto o refresh token. Remove o cookie de refresh token e adiciona o access token a uma blacklist até sua expiração natural.

## 🔐 Autenticação

✅ **Requer autenticação** via Bearer Token

```
Authorization: Bearer <access_token>
```

E também requer o cookie `refreshToken` para invalidá-lo.

## ⚡ Rate Limiting

❌ Não possui rate limiting específico

## 📨 Request

### Método e URL
```
POST /auth/logout
```

### Headers
```
Authorization: Bearer <access_token>
```

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
Set-Cookie: refreshToken=; Path=/auth; Max-Age=0; HttpOnly
Content-Type: application/json
```

> O cookie `refreshToken` é limpo (Max-Age=0)

### Body
```json
{
  "message": "Logged out successfully"
}
```

## ❌ Possíveis Erros

### 401 Unauthorized
**Quando ocorre**: Access token ausente, inválido ou expirado

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

**Cenário 3: Refresh token não encontrado**
```json
{
  "statusCode": 401,
  "message": "Refresh token not found",
  "error": "Unauthorized"
}
```

> ⚠️ **Nota**: Mesmo que o refresh token não seja encontrado, o cookie é limpo e retorna 401.

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
ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -b cookies.txt \
  -c cookies.txt
```

**Resposta**:
```json
{
  "message": "Logged out successfully"
}
```

### JavaScript (fetch)
```javascript
async function logout() {
  try {
    const accessToken = localStorage.getItem('accessToken');
    
    if (!accessToken) {
      console.warn('Nenhum token encontrado');
      // Redirecionar para login mesmo assim
      window.location.href = '/login';
      return;
    }

    const response = await fetch('http://localhost:3000/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      credentials: 'include', // Importante para enviar cookie
    });

    if (!response.ok) {
      console.error('Erro ao fazer logout');
    }

    const data = await response.json();
    console.log(data.message);
    
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
  } finally {
    // Sempre limpar token local e redirecionar
    localStorage.removeItem('accessToken');
    window.location.href = '/login';
  }
}

// Uso
logout();
```

### TypeScript (axios)
```typescript
import axios, { AxiosError } from 'axios';

interface LogoutResponse {
  message: string;
}

interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
}

async function logout(): Promise<void> {
  try {
    const accessToken = localStorage.getItem('accessToken');
    
    if (!accessToken) {
      console.warn('Usuário não autenticado');
      return;
    }

    const response = await axios.post<LogoutResponse>(
      'http://localhost:3000/auth/logout',
      {}, // Body vazio
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        withCredentials: true, // Importante para enviar cookie
      }
    );

    console.log(response.data.message);
    
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ErrorResponse>;
      console.error('Erro ao fazer logout:', axiosError.response?.data?.message);
    }
  } finally {
    // SEMPRE limpar dados locais, mesmo em caso de erro
    localStorage.removeItem('accessToken');
    
    // Limpar outros dados do usuário se houver
    // sessionStorage.clear();
    
    // Redirecionar para login
    window.location.href = '/login';
  }
}

// Uso
logout();
```

### React Hook
```typescript
import { useState } from 'react';
import axios from 'axios';

export function useLogout() {
  const [loading, setLoading] = useState(false);

  const logout = async () => {
    setLoading(true);

    try {
      const accessToken = localStorage.getItem('accessToken');
      
      if (accessToken) {
        await axios.post(
          'http://localhost:3000/auth/logout',
          {},
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
            withCredentials: true,
          }
        );
      }
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    } finally {
      // Limpar estado local
      localStorage.removeItem('accessToken');
      
      // Redirecionar
      window.location.href = '/login';
      
      setLoading(false);
    }
  };

  return { logout, loading };
}

// Uso no componente
function LogoutButton() {
  const { logout, loading } = useLogout();

  return (
    <button onClick={logout} disabled={loading}>
      {loading ? 'Saindo...' : 'Sair'}
    </button>
  );
}
```

### Com Context API (React)
```typescript
import { createContext, useContext, ReactNode } from 'react';
import axios from 'axios';

interface AuthContextType {
  user: User | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const logout = async () => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      
      if (accessToken) {
        await axios.post(
          'http://localhost:3000/auth/logout',
          {},
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            withCredentials: true,
          }
        );
      }
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    } finally {
      // Limpar estado
      setUser(null);
      localStorage.removeItem('accessToken');
      
      // Redirecionar
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ user, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// Uso
function Header() {
  const { logout } = useAuth();

  return (
    <header>
      <button onClick={logout}>Sair</button>
    </header>
  );
}
```

## 🔒 O que acontece no logout?

### Backend
1. ✅ Valida access token
2. ✅ Valida refresh token do cookie
3. ✅ Adiciona access token à **blacklist** (Redis/cache até expiração)
4. ✅ **Remove sessão** do banco de dados
5. ✅ **Limpa cookie** de refresh token
6. ✅ Retorna confirmação

### Frontend
1. ✅ Envia requisição de logout
2. ✅ Remove access token do storage
3. ✅ Limpa estado da aplicação
4. ✅ Redireciona para página de login

## 🔒 Notas de Segurança

1. **Blacklist de Access Token**:
   - Access token é adicionado a uma blacklist até sua expiração natural
   - Mesmo que alguém tenha o token, ele será rejeitado
   - Armazenado em cache (Redis) com TTL = tempo restante do token

2. **Invalidação de Refresh Token**:
   - Sessão removida do banco de dados
   - Refresh token não pode mais ser usado
   - Cookie é limpo do navegador

3. **Limpeza do Cliente**:
   - SEMPRE limpe localStorage/sessionStorage após logout
   - Limpe estado global da aplicação
   - Redirecione para tela pública

4. **Proteção contra CSRF**:
   - Cookie com SameSite=Lax
   - Requer access token válido no header
   - Dupla validação (token + cookie)

## 💡 Boas Práticas

### 1. Sempre limpar storage local
```typescript
// Limpar TUDO relacionado ao usuário
localStorage.removeItem('accessToken');
sessionStorage.clear(); // Se usar
// Limpar cache da aplicação se houver
```

### 2. Tratar erros graciosamente
```typescript
try {
  await logout();
} catch (error) {
  // Mesmo com erro, limpar localmente
  localStorage.removeItem('accessToken');
  window.location.href = '/login';
}
```

### 3. Feedback visual
```typescript
function logout() {
  // Mostrar loading
  setLoading(true);
  
  // Fazer logout
  await api.logout();
  
  // Mostrar mensagem
  toast.success('Você saiu da sua conta');
  
  // Redirecionar
  navigate('/login');
}
```

### 4. Logout global
```typescript
// Deslogar de TODAS as sessões
async function logoutAllSessions() {
  // 1. Buscar todas as sessões
  const sessions = await getSessions();
  
  // 2. Revogar todas
  await Promise.all(
    sessions.map(s => revokeSession(s.jti))
  );
  
  // 3. Fazer logout da sessão atual
  await logout();
}
```

## 🆚 Logout vs Revogar Sessão

| Ação | Logout | Revogar Sessão |
|------|--------|----------------|
| **Endpoint** | `POST /auth/logout` | `DELETE /auth/sessions/:jti` |
| **Escopo** | Sessão atual | Sessão específica (pode ser outra) |
| **Access Token** | Requerido | Requerido |
| **Blacklist** | Sim (access token atual) | Não |
| **Limpa Cookie** | Sim | Não |
| **Redireciona** | Sim (frontend) | Não necessariamente |
| **Uso** | Sair da conta | Encerrar sessão de outro dispositivo |

## 📝 Cenários Comuns

### 1. Logout simples
```typescript
<button onClick={logout}>Sair</button>
```

### 2. Logout com confirmação
```typescript
function LogoutButton() {
  const handleLogout = () => {
    if (confirm('Deseja realmente sair?')) {
      logout();
    }
  };

  return <button onClick={handleLogout}>Sair</button>;
}
```

### 3. Logout automático (inatividade)
```typescript
function useIdleLogout(idleTime = 30 * 60 * 1000) { // 30 min
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(logout, idleTime);
    };

    // Eventos que resetam o timer
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keypress', resetTimer);
    
    resetTimer();

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keypress', resetTimer);
    };
  }, [idleTime]);
}
```

### 4. Logout em múltiplas abas
```typescript
// Tab 1: Faz logout
logout();

// Tab 2: Detecta e reage
window.addEventListener('storage', (e) => {
  if (e.key === 'accessToken' && e.newValue === null) {
    // Token foi removido em outra aba
    window.location.href = '/login';
  }
});
```

## 🔗 Endpoints Relacionados

- [`POST /auth/sign-in`](./sign-in.md) - Fazer login novamente
- [`GET /auth/sessions`](./sessions.md#listar-sessoes) - Ver outras sessões ativas
- [`DELETE /auth/sessions/:jti`](./sessions.md#revogar-sessao) - Encerrar sessão específica
- [`POST /auth/refresh`](./refresh-tokens.md) - Renovar tokens (alternativa ao logout)
