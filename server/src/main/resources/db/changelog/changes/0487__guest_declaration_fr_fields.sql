-- Conformité France — phase 3 : fiche individuelle de police (CESEDA R814-1 à R814-3).
--
-- phone / email : mentions obligatoires en France (R814-2, 5°) — PII chiffrées AES-256
--   côté applicatif, comme les autres champs d'identité (VARCHAR(500) opaques).
-- signed_at     : la fiche est « remplie et signée par l'étranger » ; la certification
--   cochée par le voyageur dans le livret vaut signature, horodatée ici.
-- exempt        : voyageur dispensé de fiche (ressortissant français en France) — seule
--   son identité est notée, rien d'autre n'est collecté (minimisation RGPD).
ALTER TABLE guest_declarations ADD COLUMN IF NOT EXISTS phone VARCHAR(500);
ALTER TABLE guest_declarations ADD COLUMN IF NOT EXISTS email VARCHAR(500);
ALTER TABLE guest_declarations ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP;
ALTER TABLE guest_declarations ADD COLUMN IF NOT EXISTS exempt BOOLEAN NOT NULL DEFAULT FALSE;
