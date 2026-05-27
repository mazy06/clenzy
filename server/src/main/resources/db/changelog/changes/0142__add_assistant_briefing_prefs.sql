-- ============================================================================
-- 0142 : Briefings proactifs de l'assistant IA
-- ----------------------------------------------------------------------------
-- Contexte : transforme l'assistant de reactif en proactif. Le scheduler
-- horaire envoie des resumes/alertes selon les preferences user via 3 canaux
-- (in-app, email, WhatsApp).
--
-- Deux tables :
--   1. assistant_briefing_pref : preferences par user (frequence, canaux,
--      heure locale, timezone, on/off)
--   2. assistant_briefing_log  : journal d'envoi pour idempotence (1 par jour
--      max par user — anti-spam strict)
-- ============================================================================

-- ─── Preferences ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assistant_briefing_pref (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    keycloak_id VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    frequency VARCHAR(30) NOT NULL DEFAULT 'daily_morning'
        CHECK (frequency IN ('daily_morning','weekly_sunday','only_alerts')),
    channels JSONB NOT NULL DEFAULT '["in_app"]'::jsonb,
    time_local TIME NOT NULL DEFAULT '08:00',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Europe/Paris',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_assistant_briefing_pref_user UNIQUE (keycloak_id)
);

CREATE INDEX IF NOT EXISTS idx_assistant_briefing_pref_enabled
    ON assistant_briefing_pref (enabled, frequency);

CREATE INDEX IF NOT EXISTS idx_assistant_briefing_pref_org
    ON assistant_briefing_pref (organization_id);

COMMENT ON TABLE assistant_briefing_pref IS
    'Preferences de briefing proactif par utilisateur. Le scheduler horaire
    matche les pref dont time_local correspond a l''heure locale courante (TZ).';
COMMENT ON COLUMN assistant_briefing_pref.frequency IS
    'daily_morning : tous les jours a time_local ; weekly_sunday : dimanche a time_local ;
    only_alerts : envoye uniquement si anomalie critique detectee.';
COMMENT ON COLUMN assistant_briefing_pref.channels IS
    'Array JSONB des canaux : ["in_app"], ["email"], ["whatsapp"], ou combinaisons.';

-- ─── Journal d'envoi (idempotence) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assistant_briefing_log (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    keycloak_id VARCHAR(255) NOT NULL,
    briefing_date DATE NOT NULL,
    frequency VARCHAR(30) NOT NULL,
    conversation_id BIGINT REFERENCES assistant_conversation(id) ON DELETE SET NULL,
    channels JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'SENT'
        CHECK (status IN ('SENT','FAILED','SKIPPED')),
    error_message TEXT,
    sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_assistant_briefing_log_user_date UNIQUE (keycloak_id, briefing_date)
);

CREATE INDEX IF NOT EXISTS idx_assistant_briefing_log_org_date
    ON assistant_briefing_log (organization_id, briefing_date DESC);

COMMENT ON TABLE assistant_briefing_log IS
    'Journal des briefings envoyes. La contrainte unique (keycloak_id, briefing_date)
    garantit l''idempotence : maximum 1 briefing par jour par user, meme si le
    scheduler est invoque plusieurs fois (restart, rattrapage, etc.).';
