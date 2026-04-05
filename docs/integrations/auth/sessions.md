# 📱 Gerenciamento de Sessões

## 📋 Overview

Permite listar e gerenciar todas as sessões ativas do usuário. Cada sessão representa um dispositivo/navegador onde o usuário está logado, com informações detalhadas sobre localização, dispositivo e horário de login.

---

## 1️⃣ GET /auth/sessions
### Listar Sessões Ativas

### 📋 Descrição

Retorna todas as sessões ativas do usuário autenticado, incluindo metadata como dispositivo, navegador, IP, localização geográfica e data de login.

### 🔐 Autenticação

✅ **Requer autenticação** via Bearer Token

```
Authorization: Bearer <access_token>
```

### ⚡ Rate Limiting

❌ Não possui rate limiting específico

### 📨 Request

#### Método e URL
```
GET /auth/sessions
```

#### Headers
```
Authorization: Bearer <access_token>
```

#### Body
Não requer body.

### ✅ Response de Sucesso

#### Status Code
```
200 OK
```

#### Headers
```
Content-Type: application/json
```

#### Body
```json
[
  {
    "jti": "550e8400-e29b-41d4-a716-446655440000",
    "browser": "Chrome 120.0.0",
    "os": "Windows 10",
    "device": "Desktop",
    "ip": "192.168.1.100",
    "location": "São Paulo, SP, Brazil",
    "loginAt": "2024-01-15T10:30:00.000Z"
  },
  {
    "jti": "660e8400-e29b-41d4-a716-446655440001",
    "browser": "Safari 17.0",
    "os": "iOS 17.2",
    "device": "Mobile",
    "ip": "192.168.1.101",
    "location": "São Paulo, SP, Brazil",
    "loginAt": "2024-01-14T18:45:00.000Z"
  },
  {
    "jti": "770e8400-e29b-41d4-a716-446655440002",
    "browser": "Firefox 121.0",
    "os": "Ubuntu 22.04",
    "device": "Desktop",
    "ip": "192.168.1.102",
    "location": "Rio de Janeiro, RJ, Brazil",
    "loginAt": "2024-01-13T09:15:00.000Z"
  }
]
```

#### Response Fields

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `jti` | string (UUID) | ID único da sessão (JWT ID) |
| `browser` | string | Navegador e versão |
| `os` | string | Sistema operacional |
| `device` | string | Tipo de dispositivo (Desktop, Mobile, Tablet) |
| `ip` | string | Endereço IP do login |
| `location` | string | Localização geográfica estimada |
| `loginAt` | string (ISO 8601) | Data e hora do login |

### ❌ Possíveis Erros

#### 401 Unauthorized
**Quando ocorre**: Token ausente, inválido ou expirado

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

#### 500 Internal Server Error
**Quando ocorre**: Erro interno do servidor

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

### 💡 Exemplos de Uso

#### cURL
```bash
ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X GET http://localhost:3000/auth/sessions \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

#### JavaScript (fetch)
```javascript
async function getSessions() {
  try {
    const accessToken = localStorage.getItem('accessToken');

    const response = await fetch('http://localhost:3000/auth/sessions', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Erro ao buscar sessões');
    }

    const sessions = await response.json();
    console.log('Sessões ativas:', sessions);
    return sessions;
    
  } catch (error) {
    console.error('Erro:', error.message);
    throw error;
  }
}

// Uso
getSessions().then(sessions => {
  sessions.forEach(session => {
    console.log(`${session.device} - ${session.browser}`);
    console.log(`IP: ${session.ip}`);
    console.log(`Login: ${new Date(session.loginAt).toLocaleString()}`);
    console.log('---');
  });
});
```

#### TypeScript (axios)
```typescript
import axios from 'axios';

interface Session {
  jti: string;
  browser: string;
  os: string;
  device: string;
  ip: string;
  location: string;
  loginAt: string;
}

async function getSessions(): Promise<Session[]> {
  try {
    const accessToken = localStorage.getItem('accessToken');

    const response = await axios.get<Session[]>(
      'http://localhost:3000/auth/sessions',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    return response.data;
    
  } catch (error) {
    console.error('Erro ao buscar sessões:', error);
    throw error;
  }
}

// Uso
getSessions()
  .then(sessions => {
    console.log(`Você tem ${sessions.length} sessão(ões) ativa(s)`);
    sessions.forEach(s => console.log(`- ${s.device} (${s.location})`));
  });
```

#### React Component
```typescript
import { useState, useEffect } from 'react';
import axios from 'axios';

interface Session {
  jti: string;
  browser: string;
  os: string;
  device: string;
  ip: string;
  location: string;
  loginAt: string;
}

function SessionsList() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const accessToken = localStorage.getItem('accessToken');
        const response = await axios.get<Session[]>(
          'http://localhost:3000/auth/sessions',
          {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          }
        );
        setSessions(response.data);
      } catch (error) {
        console.error('Erro:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSessions();
  }, []);

  if (loading) return <div>Carregando sessões...</div>;

  return (
    <div>
      <h2>Sessões Ativas ({sessions.length})</h2>
      
      {sessions.map(session => (
        <div key={session.jti} className="session-card">
          <div className="session-header">
            <strong>{session.device}</strong>
            <span>{session.browser}</span>
          </div>
          
          <div className="session-details">
            <p>Sistema: {session.os}</p>
            <p>IP: {session.ip}</p>
            <p>Localização: {session.location}</p>
            <p>Login em: {new Date(session.loginAt).toLocaleString('pt-BR')}</p>
          </div>
          
          <button onClick={() => revokeSession(session.jti)}>
            Encerrar esta sessão
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## 2️⃣ DELETE /auth/sessions/:jti
### Revogar Sessão Específica

### 📋 Descrição

Encerra uma sessão específica, invalidando o refresh token associado. Útil para fazer logout remotamente de outros dispositivos.

### 🔐 Autenticação

✅ **Requer autenticação** via Bearer Token

```
Authorization: Bearer <access_token>
```

### 📨 Request

#### Método e URL
```
DELETE /auth/sessions/:jti
```

#### Path Parameters

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `jti` | string (UUID) | ID único da sessão (obtido em GET /auth/sessions) |

#### Headers
```
Authorization: Bearer <access_token>
```

#### Exemplo
```
DELETE /auth/sessions/550e8400-e29b-41d4-a716-446655440000
```

### ✅ Response de Sucesso

#### Status Code
```
204 No Content
```

Não retorna body. A ausência de erro indica sucesso.

### ❌ Possíveis Erros

#### 401 Unauthorized
**Quando ocorre**: Token ausente, inválido ou expirado

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

#### 404 Not Found
**Quando ocorre**: Sessão não encontrada ou não pertence ao usuário

```json
{
  "statusCode": 404,
  "message": "Session not found",
  "error": "Not Found"
}
```

#### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

### 💡 Exemplos de Uso

#### cURL
```bash
ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SESSION_JTI="550e8400-e29b-41d4-a716-446655440000"

curl -X DELETE "http://localhost:3000/auth/sessions/$SESSION_JTI" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

#### JavaScript (fetch)
```javascript
async function revokeSession(jti) {
  try {
    const accessToken = localStorage.getItem('accessToken');

    const response = await fetch(`http://localhost:3000/auth/sessions/${jti}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (response.status === 404) {
      throw new Error('Sessão não encontrada');
    }

    if (!response.ok) {
      throw new Error('Erro ao revogar sessão');
    }

    console.log('Sessão revogada com sucesso');
    
  } catch (error) {
    console.error('Erro:', error.message);
    throw error;
  }
}

// Uso
revokeSession('550e8400-e29b-41d4-a716-446655440000')
  .then(() => {
    alert('Sessão encerrada com sucesso');
    // Atualizar lista de sessões
  });
```

#### TypeScript (axios)
```typescript
import axios, { AxiosError } from 'axios';

async function revokeSession(jti: string): Promise<void> {
  try {
    const accessToken = localStorage.getItem('accessToken');

    await axios.delete(
      `http://localhost:3000/auth/sessions/${jti}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    console.log('Sessão revogada');
    
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      
      if (axiosError.response?.status === 404) {
        throw new Error('Sessão não encontrada');
      }
    }
    
    throw new Error('Erro ao revogar sessão');
  }
}

// Uso
revokeSession('550e8400-e29b-41d4-a716-446655440000')
  .then(() => console.log('Sessão encerrada'))
  .catch(error => console.error(error.message));
```

#### React Component com Lista
```typescript
function SessionsManager() {
  const [sessions, setSessions] = useState<Session[]>([]);

  const handleRevokeSession = async (jti: string) => {
    if (!confirm('Deseja realmente encerrar esta sessão?')) {
      return;
    }

    try {
      await revokeSession(jti);
      
      // Remover da lista localmente
      setSessions(prev => prev.filter(s => s.jti !== jti));
      
      toast.success('Sessão encerrada com sucesso');
    } catch (error) {
      toast.error('Erro ao encerrar sessão');
    }
  };

  return (
    <div>
      {sessions.map(session => (
        <div key={session.jti}>
          <SessionCard session={session} />
          <button onClick={() => handleRevokeSession(session.jti)}>
            Encerrar
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## 🔍 Identificar Sessão Atual

Para destacar a sessão atual na UI:

```typescript
import { jwtDecode } from 'jwt-decode';

interface JWTPayload {
  jti: string;
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

function getCurrentSessionJti(): string | null {
  const accessToken = localStorage.getItem('accessToken');
  if (!accessToken) return null;

  try {
    const decoded = jwtDecode<JWTPayload>(accessToken);
    return decoded.jti;
  } catch {
    return null;
  }
}

// Uso no componente
function SessionsList({ sessions }: { sessions: Session[] }) {
  const currentJti = getCurrentSessionJti();

  return (
    <div>
      {sessions.map(session => (
        <div 
          key={session.jti}
          className={session.jti === currentJti ? 'current-session' : ''}
        >
          <SessionCard session={session} />
          
          {session.jti === currentJti ? (
            <span className="badge">Sessão atual</span>
          ) : (
            <button onClick={() => revokeSession(session.jti)}>
              Encerrar
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## 🔒 Notas de Segurança

### 1. Proteção de Dados
- Apenas o próprio usuário pode ver suas sessões
- Não é possível ver sessões de outros usuários
- IP e localização são aproximados (não exatos)

### 2. Revogar vs Logout
- **Revogar**: Encerra sessão específica (outro dispositivo)
- **Logout**: Encerra sessão atual (este dispositivo)

### 3. Metadata de Sessão
Coletado no momento do login:
- **IP**: Endereço IP real
- **User-Agent**: Parseado para extrair browser, OS, device
- **Geolocation**: Baseado em IP (GeoIP Lite)
- **Timestamp**: Hora exata do login

### 4. Privacidade
- Localização é estimada (cidade/estado)
- Não rastreia localização GPS precisa
- IP não é exposto publicamente

---

## 💡 Casos de Uso

### 1. Tela de Segurança
```typescript
function SecurityPage() {
  return (
    <div>
      <h1>Segurança da Conta</h1>
      
      <section>
        <h2>Sessões Ativas</h2>
        <SessionsList />
      </section>
      
      <section>
        <h2>Ações Rápidas</h2>
        <button onClick={logoutAllSessions}>
          Encerrar todas as sessões
        </button>
      </section>
    </div>
  );
}
```

### 2. Logout de Todos os Dispositivos
```typescript
async function logoutAllSessions() {
  const sessions = await getSessions();
  
  await Promise.all(
    sessions.map(s => revokeSession(s.jti))
  );
  
  // Logout da sessão atual por último
  await logout();
}
```

### 3. Alerta de Nova Sessão
```typescript
// Backend pode enviar email quando novo login é detectado
Email: "Novo login detectado"
  Dispositivo: iPhone 15 Pro
  Localização: São Paulo, Brasil
  Hora: 15/01/2024 às 14:30
  
  Não foi você? Encerre esta sessão.
  [Link para /sessions]
```

---

## 🔗 Endpoints Relacionados

- [`POST /auth/logout`](./logout.md) - Encerrar sessão atual
- [`POST /auth/sign-in`](./sign-in.md) - Criar nova sessão
- [`POST /auth/refresh`](./refresh-tokens.md) - Renovar tokens (mantém sessão)
