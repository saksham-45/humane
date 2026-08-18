CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX comments_created ON comments (created_at DESC);
