create extension if not exists "pgcrypto";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NULL,
    name VARCHAR(255) NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_PROFILE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (status IN ('PENDING_PROFILE', 'ACTIVE', 'BLOCKED'))
);

CREATE TABLE auth_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(100) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(provider, provider_user_id)
);

CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_type VARCHAR(40) NOT NULL,
    name VARCHAR(255) NOT NULL,
    initial_balance NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deactivated_at TIMESTAMPTZ NULL,
    CHECK (account_type IN ('SAVINGS', 'CHECKING', 'CREDIT_CARD', 'CASH')),
    CHECK (
    (is_active = true AND deactivated_at IS NULL)
    OR
    (is_active = false AND deactivated_at IS NOT NULL)
    )
);

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT NULL,
    type VARCHAR(20) NOT NULL,
    icon VARCHAR(100) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deactivated_at TIMESTAMPTZ NULL,

    CHECK (type IN ('INCOME', 'EXPENSE')),
    CHECK (
        (is_active = true AND deactivated_at IS NULL)
        OR
        (is_active = false AND deactivated_at IS NOT NULL)
    )
);

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE NO ACTION,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    date DATE NOT NULL DEFAULT NOW(),
    description TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deactivated_at TIMESTAMPTZ NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    CHECK (amount > 0),
    CHECK (
        (is_active = true AND deactivated_at IS NULL)
        OR
        (is_active = false AND deactivated_at IS NOT NULL)
    )
);


-- índices para busca rápida ---------

-- EXTENSION
-- FUNÇÃO

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- INDICES
CREATE INDEX idx_transactions_user_date_id
ON transactions(user_id, date DESC, id DESC)
WHERE is_active = true;

CREATE INDEX idx_transactions_user
ON transactions(user_id)
WHERE is_active = true;

CREATE INDEX idx_transactions_account
ON transactions(account_id)
WHERE is_active = true;

CREATE INDEX idx_transactions_category
ON transactions(category_id)
WHERE is_active = true;

CREATE INDEX idx_transactions_user_date
ON transactions(user_id, date)
WHERE is_active = true;

CREATE INDEX idx_users_status ON users(status);

CREATE INDEX idx_categories_user_name_type_active
ON categories(user_id, name, type)
WHERE is_active = true;

CREATE INDEX idx_categories_user_type
ON categories (user_id, type)
WHERE is_active = true;


CREATE INDEX idx_categories_user_active
ON categories (user_id)
WHERE is_active = true;


CREATE UNIQUE INDEX idx_users_email
ON users(email)
WHERE email IS NOT NULL;

CREATE INDEX idx_auth_providers_user_id
ON auth_providers(user_id);

CREATE INDEX idx_accounts_user_id
ON accounts(user_id);

CREATE INDEX idx_accounts_user_active
ON accounts(user_id)
WHERE is_active = true;

-- TRIGGERS
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_auth_providers_updated_at
BEFORE UPDATE ON auth_providers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_accounts_updated_at
BEFORE UPDATE ON accounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_transactions_updated_at
BEFORE UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

