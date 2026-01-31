-- 지갑 자산 캐시 테이블
CREATE TABLE IF NOT EXISTS wallet_assets (
  address TEXT PRIMARY KEY,
  total_assets TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS 비활성화 (공개 데이터)
ALTER TABLE wallet_assets ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능
CREATE POLICY "Anyone can read wallet_assets" ON wallet_assets
  FOR SELECT USING (true);

-- 누구나 쓰기 가능 (API에서만 호출)
CREATE POLICY "Anyone can insert wallet_assets" ON wallet_assets
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update wallet_assets" ON wallet_assets
  FOR UPDATE USING (true);
