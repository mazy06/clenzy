-- =============================================================================
-- 0059 : Inscription email confirmation
-- Supprime le mot de passe obligatoire, ajoute token de confirmation + IDs Stripe
-- =============================================================================

-- 1. Rendre le mot de passe nullable (n'est plus collecte a l'inscription)
ALTER TABLE pending_inscriptions ALTER COLUMN password DROP NOT NULL;

-- 2. Token de confirmation email (SHA-256 hash, meme pattern que les invitations)
ALTER TABLE pending_inscriptions ADD COLUMN IF NOT EXISTS confirmation_token_hash VARCHAR(64);

-- 3. IDs Stripe (stockes au moment du webhook, utilises a la confirmation)
ALTER TABLE pending_inscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE pending_inscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

-- 4. Index sur le token hash pour lookup rapide lors de la confirmation
CREATE INDEX IF NOT EXISTS idx_pending_inscriptions_token_hash
    ON pending_inscriptions(confirmation_token_hash)
    WHERE confirmation_token_hash IS NOT NULL;
