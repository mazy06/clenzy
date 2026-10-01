-- Caution : la pre-autorisation n'est plus posee au paiement mais le jour de l'arrivee, puis
-- renouvelee avant son expiration. Une autorisation carte en ligne ne vit que 4 j 18 h (Visa,
-- transaction initiee par le marchand) a 7 j : posee a la reservation, elle etait deja
-- annulee par Stripe au moment du sejour alors que la base affirmait HELD.
--
--   hold_expires_at : capture_before Stripe (payment_method_details.card.capture_before) du hold
--                     en cours — pilote le renouvellement et le constat d'expiration.
--   hold_error      : dernier refus de pre-autorisation (code Stripe / decline_code).
--   hold_attempts   : nombre de pre-autorisations refusees — derive la cle d'idempotence d'une
--                     nouvelle tentative (Stripe rejoue sinon le refus pendant 24 h).
ALTER TABLE security_deposits ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ;
ALTER TABLE security_deposits ADD COLUMN IF NOT EXISTS hold_error VARCHAR(255);
ALTER TABLE security_deposits ADD COLUMN IF NOT EXISTS hold_attempts INTEGER NOT NULL DEFAULT 0;

-- Balayages horaires du scheduler : holds a renouveler / expires (status + echeance).
CREATE INDEX IF NOT EXISTS idx_security_deposit_status_hold_expiry
    ON security_deposits (status, hold_expires_at);

-- Nouveau statut EXPIRED : defense contre une contrainte CHECK d'enum heritee de Hibernate
-- (cf. 0274) si la table avait ete creee par ddl-auto dans un environnement.
ALTER TABLE security_deposits DROP CONSTRAINT IF EXISTS security_deposits_status_check;
