-- SHELL CLUB 가입 신청 테이블에 name 컬럼 추가
-- 승인 시 홀더 이름 저장용

ALTER TABLE shell_club_applications 
ADD COLUMN IF NOT EXISTS name TEXT;

-- approved_at 컬럼 추가 (승인 시간 기록)
ALTER TABLE shell_club_applications 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- updated_at 컬럼 추가
ALTER TABLE shell_club_applications 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_shell_club_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_shell_club_applications_updated_at ON shell_club_applications;
CREATE TRIGGER trigger_update_shell_club_applications_updated_at
  BEFORE UPDATE ON shell_club_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_shell_club_applications_updated_at();
