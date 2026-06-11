-- 0233 : préparation schéma pour le chiffrement au repos des colonnes « secret »
--        (audit DS1-SECRETS — M1-MODEL-02/03/04).
--
-- Contexte : plusieurs secrets étaient stockés EN CLAIR alors que
-- EncryptedFieldConverter (Jasypt AES-256) existe. On ajoute @Convert sur ces
-- colonnes côté entité JPA. Le ciphertext Jasypt (Base64 de salt+iv+ciphertext)
-- est NETTEMENT plus long que la valeur en clair, et n'est pas du JSON.
--
-- Ce que fait CE changeset (schéma uniquement) :
--   1. Élargit les colonnes en TEXT pour accueillir le ciphertext
--      (un code de 6 chiffres → ~60+ caractères ; un blob JSON → variable).
--   2. Convertit extra_access_codes de JSONB en TEXT : on ne peut pas stocker
--      du ciphertext (non-JSON) dans une colonne jsonb (le type Postgres le
--      rejette). Le contenu reste un JSON applicatif, désormais chiffré.
--
-- Ce que CE changeset NE fait PAS : le chiffrement réel des valeurs existantes.
-- Le chiffrement est côté Java (clé Jasypt) — impossible en SQL pur. Il est
-- assuré au boot par le runner SecretColumnEncryptionBackfill (idempotent,
-- détection clair vs. chiffré, SQL natif qui bypasse le converter).
--
-- DANGER (ddl-auto=validate + converter strict) : tant que les valeurs en clair
-- ne sont pas chiffrées, une lecture entité lève FieldDecryptionException.
-- SÉQUENCE DE DÉPLOIEMENT SÛRE (cf. doc de mission) :
--   a) déployer avec clenzy.security.field-encryption.fail-on-decrypt-error=false
--      (mode tolérant) ET clenzy.security.secret-backfill.enabled=true ;
--   b) au boot : Liquibase applique 0233 (TEXT), puis le runner chiffre les
--      valeurs en clair AVANT le trafic ;
--   c) une fois le backfill confirmé (logs), repasser fail-on-decrypt-error=true
--      (strict) au déploiement suivant.
--
-- Idempotent : élargir en TEXT est ré-exécutable sans effet (déjà TEXT) ;
-- la conversion JSONB->TEXT n'est tentée que si la colonne est encore jsonb.

-- 1. external_pricing_configs.api_key (clé PriceLabs / Beyond) — M1-MODEL-03
ALTER TABLE external_pricing_configs
    ALTER COLUMN api_key TYPE TEXT;

COMMENT ON COLUMN external_pricing_configs.api_key IS
    'Clé API du provider de pricing — CHIFFRÉE au repos (Jasypt AES-256, EncryptedFieldConverter). M1-MODEL-03.';

-- 2. integration_partners.api_key_encrypted (marketplace) — M1-MODEL-02
--    La colonne était mal nommée « encrypted » mais stockait la clé en clair.
--    Désormais chiffrée via ApiKeyEncryptionService dans MarketplaceService.
ALTER TABLE integration_partners
    ALTER COLUMN api_key_encrypted TYPE TEXT;

COMMENT ON COLUMN integration_partners.api_key_encrypted IS
    'Clé API de l''intégration marketplace — CHIFFRÉE au repos (Jasypt AES-256, ApiKeyEncryptionService). M1-MODEL-02.';

-- 3. check_in_instructions.access_code + wifi_password (secrets d'accès) — M1-MODEL-04
ALTER TABLE check_in_instructions
    ALTER COLUMN access_code TYPE TEXT;
ALTER TABLE check_in_instructions
    ALTER COLUMN wifi_password TYPE TEXT;

COMMENT ON COLUMN check_in_instructions.access_code IS
    'Code d''accès statique — CHIFFRÉ au repos (Jasypt AES-256, EncryptedFieldConverter). M1-MODEL-04.';
COMMENT ON COLUMN check_in_instructions.wifi_password IS
    'Mot de passe WiFi — CHIFFRÉ au repos (Jasypt AES-256, EncryptedFieldConverter). M1-MODEL-04.';

-- 4. check_in_instructions.extra_access_codes : JSONB -> TEXT (codes additionnels secrets)
--    Le blob JSON entier est chiffré : il ne peut plus résider dans une colonne jsonb.
--    On retire le DEFAULT jsonb '[]' (incompatible avec TEXT) puis on convertit, et on
--    repose un DEFAULT TEXT '[]' (valeur applicative chiffrée à l'écriture par le converter).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'check_in_instructions'
          AND column_name = 'extra_access_codes'
          AND data_type = 'jsonb'
    ) THEN
        ALTER TABLE check_in_instructions ALTER COLUMN extra_access_codes DROP DEFAULT;
        ALTER TABLE check_in_instructions
            ALTER COLUMN extra_access_codes TYPE TEXT USING extra_access_codes::text;
        ALTER TABLE check_in_instructions ALTER COLUMN extra_access_codes SET DEFAULT '[]';
    END IF;
END $$;

COMMENT ON COLUMN check_in_instructions.extra_access_codes IS
    'Codes d''accès additionnels (JSON [{label,code}]) — CHIFFRÉS au repos (Jasypt AES-256, EncryptedFieldConverter). Ex-JSONB converti en TEXT. M1-MODEL-04.';
