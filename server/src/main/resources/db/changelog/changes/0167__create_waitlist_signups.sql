-- Liste d'attente (waitlist) du lancement Baitly.
-- Capture les inscrits depuis la landing « Bientôt disponible » pour :
--   - classer les 20 premiers (ordre via created_at / id),
--   - faire un tirage au sort parmi tous les inscrits,
--   - alimenter une liste Brevo pour l'emailing de lancement.
CREATE TABLE IF NOT EXISTS waitlist_signups (
    id              BIGSERIAL    PRIMARY KEY,
    email           VARCHAR(320) NOT NULL,
    full_name       VARCHAR(255),
    phone           VARCHAR(40),
    property_count  VARCHAR(40),
    city            VARCHAR(255),
    source          VARCHAR(80),
    ip_address      VARCHAR(64),
    brevo_synced    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP    NOT NULL DEFAULT now()
);

-- Unicité insensible à la casse sur l'email (ré-inscription idempotente).
CREATE UNIQUE INDEX IF NOT EXISTS uq_waitlist_signups_email ON waitlist_signups (LOWER(email));
-- Classement par ordre d'arrivée (« 20 premiers »).
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_created_at ON waitlist_signups (created_at);
