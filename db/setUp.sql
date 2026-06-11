DROP TABLE IF EXISTS users;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS currency (
  id     SERIAL PRIMARY KEY,
  code   VARCHAR(10) NOT NULL UNIQUE,
  name   VARCHAR(100) NOT NULL,
  symbol VARCHAR(10) NOT NULL
);

INSERT INTO currency (code, name, symbol) VALUES
  ('COP', 'Peso colombiano', '$'),
  ('USD', 'Dólar americano', '$'),
  ('EUR', 'Euro', '€')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS wallet (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS balance (
  id          SERIAL PRIMARY KEY,
  wallet_id   INT NOT NULL REFERENCES wallet(id) ON DELETE CASCADE,
  currency_id INT NOT NULL REFERENCES currency(id),
  amount      NUMERIC(18,2) NOT NULL DEFAULT 0,
  UNIQUE (wallet_id, currency_id)
);

CREATE TABLE IF NOT EXISTS transaction (
  id               SERIAL PRIMARY KEY,
  reference        VARCHAR(36) NOT NULL DEFAULT gen_random_uuid(),
  type             VARCHAR(20) NOT NULL CHECK (type IN ('deposit','withdrawal','exchange')),
  status           VARCHAR(20) NOT NULL DEFAULT 'completed',
  amount           NUMERIC(18,2) NOT NULL,
  currency_id      INT NOT NULL REFERENCES currency(id),
  source_wallet_id INT NOT NULL REFERENCES wallet(id),
  description      TEXT,
  exchange_rate    NUMERIC(18,6),
  target_currency_id INT REFERENCES currency(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ledger_entry (
  id             SERIAL PRIMARY KEY,
  transaction_id INT NOT NULL REFERENCES transaction(id),
  wallet_id      INT NOT NULL REFERENCES wallet(id),
  currency_id    INT NOT NULL REFERENCES currency(id),
  amount         NUMERIC(18,2) NOT NULL,
  entry_type     VARCHAR(10) NOT NULL CHECK (entry_type IN ('debit','credit')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS savings_goal (
  id             SERIAL PRIMARY KEY,
  wallet_id      INT NOT NULL REFERENCES wallet(id) ON DELETE CASCADE,
  currency_id    INT NOT NULL REFERENCES currency(id),
  name           VARCHAR(255) NOT NULL,
  target_amount  NUMERIC(18,2) NOT NULL,
  current_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  target_date    DATE,
  status         VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','cancelled')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);