-- ============================================================================
-- 0148 : Templates WhatsApp custom par organisation
-- ----------------------------------------------------------------------------
-- Contexte : BriefingDelivery.sendWhatsApp envoyait jusqu'ici un template
-- pre-approuve par defaut (`engagement_update`). Avec la multiplication des
-- orgs, certaines ont leur propre template Meta-approuve avec leur branding.
-- Cette table permet a chaque org de remapper la cle logique (ex: "briefing")
-- vers son template Meta specifique ET sa langue. Si pas de mapping pour la
-- cle, BriefingDelivery retombe sur le default applicatif.
--
-- Cle logique : un slug stable ("briefing", "reservation_reminder", "checkin_link"...).
-- Templates Meta : doit etre PRE-APPROUVE cote Business Manager Meta.
-- Language : code Meta ("fr", "en", "ar", "fr_FR", "en_US", etc.).
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_whatsapp_templates (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL
        REFERENCES organization(id) ON DELETE CASCADE,
    template_key VARCHAR(64) NOT NULL,
    template_name VARCHAR(255) NOT NULL,
    template_language VARCHAR(16) NOT NULL DEFAULT 'fr',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_org_wa_templates_org_key UNIQUE (organization_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_org_wa_templates_org
    ON org_whatsapp_templates (organization_id);

COMMENT ON TABLE org_whatsapp_templates IS
    'Mapping per-org cle_logique → (template_name Meta, language). Override du default applicatif.';
COMMENT ON COLUMN org_whatsapp_templates.template_key IS
    'Slug logique stable (ex: briefing, reservation_reminder, checkin_link). Le code applicatif demande par cle, pas par nom Meta direct.';
COMMENT ON COLUMN org_whatsapp_templates.template_name IS
    'Nom du template Meta-approuve (cote Business Manager). DOIT etre approved sinon Meta refuse l''envoi.';
