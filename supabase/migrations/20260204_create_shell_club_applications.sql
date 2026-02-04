-- SHELL CLUB 가입 신청 테이블
CREATE TABLE IF NOT EXISTS shell_club_applications (
  id SERIAL PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_shell_club_applications_address ON shell_club_applications(address);
CREATE INDEX IF NOT EXISTS idx_shell_club_applications_status ON shell_club_applications(status);

-- RLS 비활성화 (간단하게)
ALTER TABLE shell_club_applications DISABLE ROW LEVEL SECURITY;
