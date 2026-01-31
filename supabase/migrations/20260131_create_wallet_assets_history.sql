-- 지갑 자산 히스토리 테이블 (일별 스냅샷)
CREATE TABLE IF NOT EXISTS wallet_assets_history (
  id SERIAL PRIMARY KEY,
  address TEXT NOT NULL,
  total_assets TEXT,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 같은 날 같은 주소는 하나만
  UNIQUE(address, recorded_at)
);

-- 인덱스 (조회 성능)
CREATE INDEX idx_wallet_history_address ON wallet_assets_history(address);
CREATE INDEX idx_wallet_history_recorded_at ON wallet_assets_history(recorded_at);

-- RLS 활성화
ALTER TABLE wallet_assets_history ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능
CREATE POLICY "Anyone can read wallet_assets_history" ON wallet_assets_history
  FOR SELECT USING (true);

-- 누구나 쓰기 가능 (API에서만 호출)
CREATE POLICY "Anyone can insert wallet_assets_history" ON wallet_assets_history
  FOR INSERT WITH CHECK (true);
