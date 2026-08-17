CREATE TABLE players (
  id TEXT PRIMARY KEY,
  username_norm TEXT NOT NULL UNIQUE,
  username_display TEXT NOT NULL,
  created_at TEXT NOT NULL,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_play_date TEXT,
  last_result TEXT
);

CREATE TABLE pairs (
  id TEXT PRIMARY KEY,
  play_date TEXT NOT NULL UNIQUE,
  topic TEXT NOT NULL,
  left_text TEXT NOT NULL,
  right_text TEXT NOT NULL,
  human_side TEXT NOT NULL CHECK (human_side IN ('left', 'right')),
  human_source TEXT NOT NULL,
  ai_model TEXT NOT NULL,
  tell TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE guesses (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  play_date TEXT NOT NULL,
  picked_side TEXT NOT NULL CHECK (picked_side IN ('left', 'right')),
  correct INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (player_id, play_date),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX guesses_play_date_correct ON guesses (play_date, correct, created_at);
CREATE INDEX players_board ON players (current_streak DESC, longest_streak DESC);
