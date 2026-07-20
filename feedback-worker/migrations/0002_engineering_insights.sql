ALTER TABLE engineering_experience
ADD COLUMN insight_text TEXT NOT NULL DEFAULT '' CHECK (length(insight_text) <= 1200);
