-- Parrainage voyageur (2.11) : un voyageur partage son code de parrainage ; quand un nouveau
-- voyageur l'utilise et termine son 1er séjour direct, les DEUX reçoivent un crédit fidélité
-- (referral_credit_cents, org-level). Le crédit réutilise le ledger guest_credit_* (type GRANT).

-- Montant du crédit de parrainage par côté (centimes ; NULL/0 = programme désactivé).
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS referral_credit_cents INTEGER;

-- Code de parrainage stable par compte de crédit (généré à la demande), unique par org.
ALTER TABLE guest_credit_accounts ADD COLUMN IF NOT EXISTS referral_code VARCHAR(32);
CREATE UNIQUE INDEX IF NOT EXISTS uq_guest_credit_referral_code
    ON guest_credit_accounts(organization_id, referral_code)
    WHERE referral_code IS NOT NULL;

-- Lien de parrainage : un parrainé (referee) est rattaché une seule fois par org, à une réservation.
CREATE TABLE IF NOT EXISTS guest_referrals (
    id               BIGSERIAL PRIMARY KEY,
    organization_id  BIGINT NOT NULL REFERENCES organizations(id),
    referee_email    VARCHAR(255) NOT NULL,
    referrer_email   VARCHAR(255) NOT NULL,
    referral_code    VARCHAR(32) NOT NULL,
    reservation_code VARCHAR(100) NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at       TIMESTAMP NOT NULL DEFAULT now(),
    granted_at       TIMESTAMP,
    CONSTRAINT uq_guest_referral_referee UNIQUE (organization_id, referee_email)
);
CREATE INDEX IF NOT EXISTS idx_guest_referral_reservation
    ON guest_referrals(organization_id, reservation_code);
