-- Finished SHUFL matches. Recent history stays in the browser; this table is the old archive.
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  played_at TEXT NOT NULL,
  name1 TEXT NOT NULL,
  name2 TEXT NOT NULL,
  score1 INTEGER NOT NULL,
  score2 INTEGER NOT NULL,
  target INTEGER NOT NULL,
  winner_index INTEGER,
  winner_name TEXT,
  rounds_json TEXT NOT NULL,
  hammer_mode TEXT,
  meta_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_games_played_at ON games (played_at DESC);

-- Case-normalized win counts. A name on either side counts as a game played.
CREATE VIEW IF NOT EXISTS leaderboard AS
SELECT
  name_key,
  MAX(display_name) AS name,
  COUNT(DISTINCT id) AS games,
  SUM(win) AS wins
FROM (
  SELECT
    id,
    lower(trim(name1)) AS name_key,
    trim(name1) AS display_name,
    CASE WHEN winner_index = 0 THEN 1 ELSE 0 END AS win
  FROM games
  WHERE trim(name1) <> ''
  UNION ALL
  SELECT
    id,
    lower(trim(name2)) AS name_key,
    trim(name2) AS display_name,
    CASE WHEN winner_index = 1 THEN 1 ELSE 0 END AS win
  FROM games
  WHERE trim(name2) <> ''
) AS appearances
GROUP BY name_key;
