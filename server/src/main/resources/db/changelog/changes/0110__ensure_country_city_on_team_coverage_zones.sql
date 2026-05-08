-- Fix-forward de la migration 0109 (qui utilisait splitStatements:false a tort
-- pour du SQL simple multi-statements et pouvait laisser le schema partiellement
-- migre en prod). Cette migration est entierement idempotente : elle no-op si
-- le schema attendu est deja en place, sinon elle le complete.

ALTER TABLE team_coverage_zones ADD COLUMN IF NOT EXISTS country VARCHAR(2);

ALTER TABLE team_coverage_zones ADD COLUMN IF NOT EXISTS city VARCHAR(100);

UPDATE team_coverage_zones SET country = 'FR' WHERE country IS NULL;

ALTER TABLE team_coverage_zones ALTER COLUMN country SET DEFAULT 'FR';

ALTER TABLE team_coverage_zones ALTER COLUMN country SET NOT NULL;

ALTER TABLE team_coverage_zones ALTER COLUMN department DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tcz_country_city
    ON team_coverage_zones (country, LOWER(city))
    WHERE city IS NOT NULL;
