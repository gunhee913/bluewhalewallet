-- 토큰 공급량 히스토리 테이블
CREATE TABLE IF NOT EXISTS token_supply_history (
  id SERIAL PRIMARY KEY,
  recorded_at DATE NOT NULL,
  bwpm_nft NUMERIC,
  sbwpm_kaia NUMERIC,
  sbwpm_avalanche NUMERIC,
  burned_amount NUMERIC,
  buyback_gofun NUMERIC,
  buyback_dolfun NUMERIC,
  buyback_amount NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(recorded_at)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_token_supply_history_recorded_at ON token_supply_history(recorded_at DESC);
