CREATE TABLE IF NOT EXISTS game_rankings (
  id SERIAL PRIMARY KEY,
  nickname VARCHAR(12) NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  tier_reached INTEGER NOT NULL DEFAULT 1,
  gold_earned INTEGER NOT NULL DEFAULT 0,
  kill_count INTEGER NOT NULL DEFAULT 0,
  play_time_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_rankings_score ON game_rankings(score DESC);
CREATE INDEX IF NOT EXISTS idx_game_rankings_created_at ON game_rankings(created_at DESC);

CREATE OR REPLACE FUNCTION update_game_rankings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_game_rankings_updated_at ON game_rankings;
CREATE TRIGGER trg_game_rankings_updated_at
  BEFORE UPDATE ON game_rankings
  FOR EACH ROW
  EXECUTE FUNCTION update_game_rankings_updated_at();
