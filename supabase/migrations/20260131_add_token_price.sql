-- token_burn 테이블에 token_price 컬럼 추가
ALTER TABLE token_burn 
ADD COLUMN IF NOT EXISTS token_price DECIMAL(20, 6) DEFAULT 0;

-- 인덱스 추가 (토큰별 히스토리 조회용)
CREATE INDEX IF NOT EXISTS idx_token_burn_token_name_date 
ON token_burn(token_name, recorded_at DESC);
