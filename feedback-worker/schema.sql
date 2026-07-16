CREATE TABLE IF NOT EXISTS feedback (
  article_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('useful', 'questionable', 'irrelevant', 'broken')),
  reliability_score INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (article_id, client_id)
);

CREATE INDEX IF NOT EXISTS feedback_updated_at_idx ON feedback(updated_at);
