-- ============================================================================
-- V91 : Ajout du type de gardien (commercant ou particulier) sur les points KeyVault
-- ============================================================================

ALTER TABLE key_exchange_points
  ADD COLUMN guardian_type VARCHAR(20);

-- Les points Clenzy KeyVault existants sont des commercants par defaut
UPDATE key_exchange_points SET guardian_type = 'MERCHANT' WHERE provider = 'CLENZY_KEYVAULT';

CREATE INDEX idx_kep_guardian_type ON key_exchange_points(guardian_type);
