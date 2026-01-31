-- wallet_assets_history 테이블에 UPDATE 정책 추가 (upsert 지원)
CREATE POLICY "Anyone can update wallet_assets_history" ON wallet_assets_history
  FOR UPDATE USING (true) WITH CHECK (true);
