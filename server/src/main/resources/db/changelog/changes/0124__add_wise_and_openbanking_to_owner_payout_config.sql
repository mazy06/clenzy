--
-- 0124 : Ajout des colonnes Wise + Open Banking sur owner_payout_config
-- ---------------------------------------------------------------------------
-- Étend l'entité OwnerPayoutConfig pour stocker les identifiants
-- spécifiques aux deux nouvelles methodes de payout :
--
--   - WISE         : recipient_id Wise (créé via leur API quand l'owner
--                    fournit IBAN + nom). Profile id de Clenzy = global.
--   - OPEN_BANKING : consent_id GoCardless / Tink obtenu lors du flow PIS.
--                    Permet ensuite d'initier des virements depuis le compte
--                    bancaire Clenzy sans repasser par SCA tant que le
--                    consent est valide (90 jours typique).
--
-- Les valeurs sensibles sont stockees en texte ; l'IBAN reste dans la
-- colonne `iban` existante (chiffree via EncryptedFieldConverter cote JPA).
-- Wise et Open Banking ne stockent pas de secret car les identifiants
-- sont déjà des références opaques côté provider.
-- ---------------------------------------------------------------------------

ALTER TABLE owner_payout_config
    ADD COLUMN IF NOT EXISTS wise_recipient_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS wise_profile_id   VARCHAR(64),
    ADD COLUMN IF NOT EXISTS open_banking_provider   VARCHAR(20),
    ADD COLUMN IF NOT EXISTS open_banking_consent_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS open_banking_consent_expires_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN owner_payout_config.wise_recipient_id IS
    'ID du recipient Wise (cree via POST /v1/accounts) — utilise pour deduplique.';
COMMENT ON COLUMN owner_payout_config.wise_profile_id IS
    'Optional Wise profile id de l''owner si l''utilisateur a son propre profile Wise.';
COMMENT ON COLUMN owner_payout_config.open_banking_provider IS
    'Provider PIS utilise: GOCARDLESS ou TINK. Null = pas encore configure.';
COMMENT ON COLUMN owner_payout_config.open_banking_consent_id IS
    'Consent ID retourne par le PIS au moment du SCA. Reutilise sur 90 jours.';
COMMENT ON COLUMN owner_payout_config.open_banking_consent_expires_at IS
    'Date d''expiration du consent (typiquement +90 jours apres le SCA).';

-- Index pour les lookups par recipient_id (idempotence cote Wise webhook)
CREATE INDEX IF NOT EXISTS idx_owner_payout_config_wise_recipient
    ON owner_payout_config(wise_recipient_id)
    WHERE wise_recipient_id IS NOT NULL;
