-- SHELL CLUB 보유량 히스토리 테이블
CREATE TABLE IF NOT EXISTS shell_club_holdings (
  id SERIAL PRIMARY KEY,
  address TEXT NOT NULL,
  shell_amount NUMERIC NOT NULL DEFAULT 0,
  shell_value NUMERIC NOT NULL DEFAULT 0,
  shell_price NUMERIC NOT NULL DEFAULT 0,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(address, recorded_at)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_shell_club_holdings_address ON shell_club_holdings(address);
CREATE INDEX IF NOT EXISTS idx_shell_club_holdings_recorded_at ON shell_club_holdings(recorded_at DESC);

-- RLS 활성화
ALTER TABLE shell_club_holdings ENABLE ROW LEVEL SECURITY;

-- 읽기 정책 (모든 사용자)
CREATE POLICY "Allow read access to shell_club_holdings"
  ON shell_club_holdings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 쓰기 정책 (서비스 역할만)
CREATE POLICY "Allow insert for service role"
  ON shell_club_holdings
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Allow update for service role"
  ON shell_club_holdings
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
