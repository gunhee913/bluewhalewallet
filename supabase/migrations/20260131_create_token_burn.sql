-- 토큰 소각 현황 테이블
CREATE TABLE IF NOT EXISTS token_burn (
  id SERIAL PRIMARY KEY,
  token_name TEXT NOT NULL,
  total_supply NUMERIC NOT NULL,        -- 총 발행량
  burned_amount NUMERIC,                 -- 소각 개수 (Units)
  burned_value TEXT,                     -- 소각 금액 ($)
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 같은 날 같은 토큰은 하나만
  UNIQUE(token_name, recorded_at)
);

-- 인덱스
CREATE INDEX idx_token_burn_name ON token_burn(token_name);
CREATE INDEX idx_token_burn_date ON token_burn(recorded_at);

-- RLS 활성화
ALTER TABLE token_burn ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능
CREATE POLICY "Anyone can read token_burn" ON token_burn
  FOR SELECT USING (true);

-- 누구나 쓰기 가능 (API에서만 호출)
CREATE POLICY "Anyone can insert token_burn" ON token_burn
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update token_burn" ON token_burn
  FOR UPDATE USING (true);
