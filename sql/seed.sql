-- =========================
-- EXTENSÕES
-- =========================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================
-- LIMPEZA (opcional, bom pra reset)
-- =========================
TRUNCATE TABLE
  transactions,
  accounts,
  categories,
  users
RESTART IDENTITY CASCADE;

-- =========================
-- USERS
-- =========================
INSERT INTO users (
  id,
  name,
  email,
  created_at
) VALUES (
  'c174e580-f987-4055-a056-3bfd1549d2a8',
  'Daniel Félix',
  'daniel@email.com',
  now()
);

-- =========================
-- ACCOUNTS
-- =========================
INSERT INTO accounts (
  id,
  user_id,
  account_type,
  name,
  initial_balance,
  created_at
) VALUES
(
  '901326ba-96df-4a20-a32b-de6688f40632',
  'c174e580-f987-4055-a056-3bfd1549d2a8',
  'CHECKING',
  'Conta Nubank',
  2500.00,
  now()
),
(
  '9223bc25-96e8-48c9-aace-bdb20620e0c8',
  'c174e580-f987-4055-a056-3bfd1549d2a8',
  'CREDIT_CARD',
  'Cartão Nubank',
  0.00,
  now()
);

-- =========================
-- CATEGORIES
-- =========================
INSERT INTO categories (
  id,
  user_id,
  name,
  type
) VALUES
(
  'd80faa91-4cc1-42fe-b317-532c6080c726',
  'c174e580-f987-4055-a056-3bfd1549d2a8',
  'Salário',
  'INCOME'
),
(
  '16446f9f-8da6-49ad-8f77-bb209cf71160',
  'c174e580-f987-4055-a056-3bfd1549d2a8',
  'Moradia',
  'EXPENSE'
),
(
  '49b46894-adc7-4441-982b-0149f869c451',
  'c174e580-f987-4055-a056-3bfd1549d2a8',
  'Alimentação',
  'EXPENSE'
),
(
  '7d2874e2-ee40-4242-bfb8-ac7144d2fa14',
  'c174e580-f987-4055-a056-3bfd1549d2a8',
  'Assinaturas',
  'EXPENSE'
);

-- =========================
-- TRANSACTIONS
-- =========================
INSERT INTO transactions (
  user_id,
  account_id,
  category_id,
  amount,
  date,
  description,
  created_at
) VALUES
(
  'c174e580-f987-4055-a056-3bfd1549d2a8',
  '901326ba-96df-4a20-a32b-de6688f40632',
  'd80faa91-4cc1-42fe-b317-532c6080c726',
  4500.00,
  '2025-01-05',
  'Salário Janeiro',
  now()
),
(
  'c174e580-f987-4055-a056-3bfd1549d2a8',
  '901326ba-96df-4a20-a32b-de6688f40632',
  '16446f9f-8da6-49ad-8f77-bb209cf71160',
  1500.00,
  '2025-01-06',
  'Aluguel',
  now()
),
(
  'c174e580-f987-4055-a056-3bfd1549d2a8',
  '9223bc25-96e8-48c9-aace-bdb20620e0c8',
  '49b46894-adc7-4441-982b-0149f869c451',
  85.90,
  '2025-01-07',
  'Ifood',
  now()
),
(
  'c174e580-f987-4055-a056-3bfd1549d2a8',
  '9223bc25-96e8-48c9-aace-bdb20620e0c8',
  '7d2874e2-ee40-4242-bfb8-ac7144d2fa14',
  39.90,
  '2025-01-08',
  'Spotify',
  now()
);
