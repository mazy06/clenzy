-- 0303 : Branding white-label de l'organisation (campagne X9-b) — logo + couleur
-- d'accent affiches sur la Constellation Proprietaire (/owner-view/:token).
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS branding_logo_url VARCHAR(500);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS branding_primary_color VARCHAR(7);
