-- ============================================================================
-- 0153 : WhatsApp Provider Strategy (Meta Cloud API vs OpenWA self-hosted)
-- ----------------------------------------------------------------------------
-- Contexte : Clenzy supporte historiquement uniquement Meta Cloud API (graph
-- Facebook v18.0) pour WhatsApp. On ajoute OpenWA (whatsapp-web.js self-hosted)
-- comme provider optionnel pour les orgs qui :
--   - veulent eviter les couts conversation-based de Meta ($0.014-$0.07/conv)
--   - n'ont pas (encore) de Meta Business Manager verifie
--   - testent Clenzy en trial avec leur WhatsApp perso
--
-- Choix architecturaux :
--   - 1 provider actif par org a la fois (pas de multi-provider simultane)
--   - Meta reste le DEFAULT (compliance B2B, features riches, SLA)
--   - OpenWA est expose en option "avancee" avec disclaimer ToS
--
-- Migration :
--   - provider VARCHAR(16) NOT NULL DEFAULT 'META' (back-compat : orgs
--     existantes restent en Meta automatiquement)
--   - openwa_session_id : identifiant de session sur l'instance OpenWA
--     (correspond a un compte WhatsApp scanne via QR code)
--   - openwa_api_key : cle API de l'instance OpenWA, chiffree (Jasypt
--     comme api_token Meta). NULL si provider=META.
--
-- Note securite : openwa_api_key doit utiliser le meme converter
-- EncryptedFieldConverter que api_token (cf. WhatsAppConfig.java).
-- ============================================================================

ALTER TABLE whatsapp_configs
    ADD COLUMN IF NOT EXISTS provider VARCHAR(16) NOT NULL DEFAULT 'META',
    ADD COLUMN IF NOT EXISTS openwa_session_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS openwa_api_key VARCHAR(1000);

-- Contrainte : provider doit etre dans la liste connue (defense en profondeur
-- contre une corruption applicative qui ecrirait une valeur invalide).
ALTER TABLE whatsapp_configs
    DROP CONSTRAINT IF EXISTS whatsapp_configs_provider_check;

ALTER TABLE whatsapp_configs
    ADD CONSTRAINT whatsapp_configs_provider_check
    CHECK (provider IN ('META', 'OPENWA'));

-- Index sur provider pour les rapports admin (combien d'orgs sur chaque
-- provider, surveiller le ratio adoption OpenWA vs Meta).
CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_provider
    ON whatsapp_configs (provider);

COMMENT ON COLUMN whatsapp_configs.provider IS
    'Provider WhatsApp actif : META (Cloud API officielle, default) ou OPENWA (whatsapp-web.js self-hosted, non officiel).';
COMMENT ON COLUMN whatsapp_configs.openwa_session_id IS
    'ID de session sur l''instance OpenWA partagee. Cree au scan du QR code. NULL si provider=META.';
COMMENT ON COLUMN whatsapp_configs.openwa_api_key IS
    'Cle API per-session OpenWA (chiffree Jasypt). Distincte du token Meta. NULL si provider=META.';
