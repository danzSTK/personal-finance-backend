# Auth & User – Regras de Negócio

Este documento define as regras de autenticação, identidade e relacionamento entre `User` e `AuthProvider`.

---

## 1. Conceitos Fundamentais

### 1.1 User
Representa a **pessoa** dentro do sistema.

- Não representa login
- Pode existir sem email
- Pode ter múltiplas formas de autenticação
- É dono de contas, categorias e transações

### 1.2 AuthProvider
Representa uma **identidade de autenticação**.

- Cada registro equivale a UMA forma de login
- Um User pode ter N AuthProviders
- A identidade real é `(provider + provider_user_id)`

---

## 2. Relacionamento

- `User 1:N AuthProvider`
- Um usuário pode:
  - Logar com Google
  - Depois criar login com email/senha
  - Depois logar com Apple
- Tudo aponta para o MESMO `user_id`

---

## 3. Tipos de Login

### 3.1 Login Social (Google, Apple, Facebook)

#### Identidade
- `provider`: GOOGLE | APPLE | FACEBOOK
- `provider_user_id`: ID único retornado pelo provedor
- Nunca editável
- Nunca muda

#### Email
- Se retornado, pode ser salvo em `user.email`
- Email NÃO é identidade
- Email pode mudar ou ser removido

---

### 3.2 Login com Email e Senha

#### Identidade
- `provider = EMAIL`
- `provider_user_id = email`
- `password_hash` obrigatório

#### Regras
- Email aqui é identidade
- Não pode existir dois `provider = EMAIL` com o mesmo email
- Troca de email exige processo de verificação

---

## 4. Alteração de Email

### 4.1 User.email
- Pode ser alterado livremente
- Usado para:
  - Comunicação
  - Marketing
  - Notificações

### 4.2 Email de Login (AuthProvider EMAIL)

- Não pode ser editado diretamente
- Deve seguir fluxo:
  1. Solicitação
  2. Confirmação no novo email
  3. Atualização do `provider_user_id`
  4. Atualização opcional do `user.email`

---

## 5. Recuperação de Senha

### Aplicável apenas para:
- `provider = EMAIL`

Fluxo:
1. Usuário informa email
2. Sistema busca em `auth_providers`
3. Gera token de recuperação
4. Atualiza `password_hash`

⚠️ `user.email` não participa do login nem da recuperação

---

## 6. Linkar Múltiplos Logins

### Cenários permitidos
- Login social → criar login email/senha
- Login email/senha → linkar Google
- Login Google → linkar Apple

### Regra
- Só pode linkar se o usuário estiver autenticado
- Nunca criar novo User automaticamente se já existir sessão

---

## 7. O que armazenar em cada entidade

### User
- email (opcional)
- name
- status
- dados de domínio (contas, categorias, transações)

### AuthProvider
- provider
- provider_user_id
- password_hash (apenas EMAIL)
- created_at / updated_at

---

## 8. Princípios de Segurança

- Nunca usar email como identidade social
- Nunca permitir edição direta de provider_user_id
- Toda troca de identidade deve ser auditável
- Login social não depende de email

---

## 9. Decisões Arquiteturais

- Auth desacoplado do User
- Identidade ≠ Perfil
- Modelo suporta escala, múltiplos provedores e futuras integrações

