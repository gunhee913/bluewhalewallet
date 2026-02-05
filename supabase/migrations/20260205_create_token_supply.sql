-- 토큰 총 공급량 테이블
CREATE TABLE IF NOT EXISTS token_supply (
  id SERIAL PRIMARY KEY,
  token_name TEXT NOT NULL UNIQUE,
  circulating_supply NUMERIC,
  avalanche_balance NUMERIC,
  buyback_gofun NUMERIC,
  buyback_dolfun NUMERIC,
  buyback_amount NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_token_supply_token_name ON token_supply(token_name);
