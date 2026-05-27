-- ============================================================================
-- 0151 : Champs de consentement RGPD + attribution pour l'inscription
-- ----------------------------------------------------------------------------
-- Contexte : la creation de compte doit acter un consentement explicite aux
-- CGU/Politique de confidentialite (obligation legale RGPD avant paiement) et
-- proposer un opt-in newsletter granulaire (consentement separe). On en profite
-- pour collecter des metriques d'acquisition : code promo / cooptation et
-- canal de decouverte ("Comment nous avez-vous connu ?").
--
-- Les colonnes sont ajoutees a la fois sur `pending_inscriptions` (capture lors
-- de l'initiation, avant paiement) et sur `users` (recopie a la finalisation
-- pour audit + ciblage marketing post-inscription).
--
-- Pourquoi accepted_terms_at TIMESTAMP plutot qu'un BOOLEAN : on stocke
-- l'horodatage du consentement, pas juste un drapeau. Cle pour les audits
-- RGPD ("a quel moment l'utilisateur a-t-il accepte ?") et la version des CGU
-- en vigueur (la version se deduit de la date par defaut, peut etre etendue
-- via une table `terms_versions` plus tard).
-- ============================================================================

-- ─── pending_inscriptions ────────────────────────────────────────────────

ALTER TABLE pending_inscriptions
    ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMP NULL;

ALTER TABLE pending_inscriptions
    ADD COLUMN IF NOT EXISTS newsletter_opt_in BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE pending_inscriptions
    ADD COLUMN IF NOT EXISTS promo_code VARCHAR(50) NULL;

ALTER TABLE pending_inscriptions
    ADD COLUMN IF NOT EXISTS referral_source VARCHAR(50) NULL;

COMMENT ON COLUMN pending_inscriptions.accepted_terms_at IS
    'Horodatage du consentement aux CGU/Politique de confidentialite. NULL = pas encore consenti. Pose au moment du POST /api/public/inscription.';
COMMENT ON COLUMN pending_inscriptions.newsletter_opt_in IS
    'Consentement separe pour la newsletter (RGPD : consentement granulaire). FALSE par defaut.';
COMMENT ON COLUMN pending_inscriptions.promo_code IS
    'Code promo / cooptation saisi a l''inscription. Indexe pour les rapports d''acquisition.';
COMMENT ON COLUMN pending_inscriptions.referral_source IS
    'Canal de decouverte declare : google, social, word_of_mouth, press, partner, other.';

-- Index pour les rapports d'acquisition (filtrage promo_code IS NOT NULL).
CREATE INDEX IF NOT EXISTS idx_pending_inscriptions_promo_code
    ON pending_inscriptions (promo_code)
    WHERE promo_code IS NOT NULL;

-- ─── users ────────────────────────────────────────────────────────────────

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMP NULL;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS newsletter_opt_in BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS promo_code VARCHAR(50) NULL;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS referral_source VARCHAR(50) NULL;

COMMENT ON COLUMN users.accepted_terms_at IS
    'Horodatage du consentement aux CGU/Politique de confidentialite. Recopie depuis pending_inscriptions a la finalisation. Sert d''audit RGPD.';
COMMENT ON COLUMN users.newsletter_opt_in IS
    'Consentement pour recevoir la newsletter Clenzy. Modifiable par l''utilisateur dans /settings/notifications.';
COMMENT ON COLUMN users.promo_code IS
    'Code promo / cooptation utilise a l''inscription. NULL = pas de code utilise.';
COMMENT ON COLUMN users.referral_source IS
    'Canal de decouverte declare a l''inscription. Sert aux rapports d''acquisition.';

-- Index pour les rapports d'acquisition par canal.
CREATE INDEX IF NOT EXISTS idx_users_referral_source
    ON users (referral_source)
    WHERE referral_source IS NOT NULL;
