-- ============================================================================
-- 0209 : Image des services payants stockée en base (data URL base64)
-- ============================================================================
-- L'hôte n'uploade plus une URL externe mais une image (compressée en data URL
-- base64, stockée directement en base comme les autres images). Une data URL
-- dépasse VARCHAR(1000) → on élargit la colonne en TEXT. Idempotent (ALTER TYPE
-- TEXT est sûr même si déjà TEXT).
-- ============================================================================

ALTER TABLE upsell_offers ALTER COLUMN image_url TYPE TEXT;
