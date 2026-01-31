-- 토큰 정보 테이블 (총 발행량 관리용)
CREATE TABLE IF NOT EXISTS token_info (
  token_name TEXT PRIMARY KEY,
  total_supply NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 초기 데이터 삽입
INSERT INTO token_info (token_name, total_supply) VALUES
  ('sBWPM', 7000),
  ('sADOL', 70000),
  ('CLAM', 70000000),
  ('PEARL', 49728492),
  ('SHELL', 968025078),
  ('CORAL', 469080),
  ('AQUA1', 207900)
ON CONFLICT (token_name) DO UPDATE SET
  total_supply = EXCLUDED.total_supply,
  updated_at = NOW();
