-- 0304 : question utilisateur d'origine sur agent_run (campagne L3, what-if replay).
-- Tronquee a 500 chars cote code ; NULL = run anterieur / autonome / reprise.
ALTER TABLE agent_run ADD COLUMN IF NOT EXISTS user_query VARCHAR(500);
