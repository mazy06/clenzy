-- Campagne Baitly — flux deterministes Vague 1 : cles d'idempotence METIER des
-- executeurs du moteur AutomationRule. Les declencheurs recurrents
-- (dedupePerSubject=false : OWNER_MONTHLY_STATEMENT, PAYOUT_PENDING_REMINDER)
-- ne sont PAS dedupliques par le moteur — chaque executeur porte sa cle.
--
-- 1) F9a releve proprietaire mensuel (SEND_OWNER_STATEMENT) : un releve est un
--    email reel — jamais deux envois pour le meme proprietaire sur le meme mois
--    (contrainte unique org+owner+periode). La ligne est posee AVANT l'envoi
--    (claim, success=false) puis passee a success=true apres envoi : un echec
--    laisse un statut explicite en base sans risque de double envoi.
CREATE TABLE IF NOT EXISTS owner_statement_dispatch (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    owner_id BIGINT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    success BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_owner_statement_dispatch UNIQUE (organization_id, owner_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_owner_statement_dispatch_org
    ON owner_statement_dispatch (organization_id);

-- 2) F9b relance payout en attente (NOTIFY_STAFF) : UNE SEULE relance par
--    payout — timestamp pose par UPDATE conditionnel (CAS, regle audit n°8)
--    avant la notification. NULL = jamais relance.
ALTER TABLE owner_payouts
    ADD COLUMN IF NOT EXISTS approval_reminder_sent_at TIMESTAMPTZ;
