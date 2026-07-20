CREATE TABLE IF NOT EXISTS feedback (
  article_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('useful', 'questionable', 'irrelevant', 'broken')),
  reliability_score INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (article_id, client_id)
);

CREATE INDEX IF NOT EXISTS feedback_updated_at_idx ON feedback(updated_at);

CREATE TABLE IF NOT EXISTS engineering_experience (
  article_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  applicability TEXT NOT NULL CHECK (applicability IN ('supports', 'conditional', 'contradicts', 'uncertain')),
  component TEXT NOT NULL CHECK (component IN ('gearbox', 'planetary', 'high_speed', 'main_bearing', 'gear_bearing', 'lubrication', 'monitoring', 'drivetrain', 'other')),
  failure_mode TEXT NOT NULL CHECK (failure_mode IN ('micropitting', 'wec', 'scuffing', 'tooth_failure', 'bearing_damage', 'electrical_damage', 'lubrication', 'monitoring', 'loads', 'manufacturing', 'other', 'not_applicable')),
  evidence_level TEXT NOT NULL CHECK (evidence_level IN ('test_report', 'failure_analysis', 'multiple_cases', 'single_case', 'engineering_judgment')),
  power_range TEXT NOT NULL CHECK (power_range IN ('under_5mw', '5_10mw', 'over_10mw', 'unknown')),
  environment TEXT NOT NULL CHECK (environment IN ('onshore', 'offshore', 'test_bench', 'unknown')),
  insight_text TEXT NOT NULL DEFAULT '' CHECK (length(insight_text) <= 1200),
  confidence INTEGER NOT NULL CHECK (confidence BETWEEN 1 AND 5),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (article_id, client_id)
);

CREATE INDEX IF NOT EXISTS engineering_experience_updated_at_idx ON engineering_experience(updated_at);
