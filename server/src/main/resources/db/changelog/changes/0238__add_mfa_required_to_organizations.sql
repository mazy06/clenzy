-- 2FA (CLZ-P0-09) : politique d'organisation exigeant l'auth a deux facteurs.
-- Stockage de la policy cote app ; l'enrolement/verification TOTP est gere par
-- le realm Keycloak (clenzy-infra). Idempotent.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS mfa_required BOOLEAN NOT NULL DEFAULT FALSE;
