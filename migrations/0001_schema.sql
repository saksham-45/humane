CREATE TABLE players (
  id TEXT PRIMARY KEY,
  username_norm TEXT NOT NULL UNIQUE,
  username_display TEXT NOT NULL,
  avatar TEXT NOT NULL,
  created_at TEXT NOT NULL,
  score_total INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE pairs (
  id TEXT PRIMARY KEY,
  play_date TEXT NOT NULL,
  day_index INTEGER NOT NULL CHECK (day_index BETWEEN 0 AND 4),
  topic TEXT NOT NULL,
  left_text TEXT NOT NULL,
  right_text TEXT NOT NULL,
  human_side TEXT NOT NULL CHECK (human_side IN ('left', 'right')),
  human_source TEXT NOT NULL,
  ai_model TEXT NOT NULL,
  tell TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (play_date, day_index)
);

CREATE TABLE guesses (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  play_date TEXT NOT NULL,
  pair_id TEXT NOT NULL,
  picked_side TEXT NOT NULL CHECK (picked_side IN ('left', 'right')),
  correct INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (player_id, pair_id),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX guesses_player_date ON guesses (player_id, play_date);
CREATE INDEX guesses_play_date_correct ON guesses (play_date, correct);
CREATE INDEX players_score ON players (score_total DESC, username_display ASC);
