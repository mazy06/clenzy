-- ============================================================================
-- 0149 : Vision token usage tracking + alertes per-org
-- ----------------------------------------------------------------------------
-- Contexte : l'assistant accepte des images uploadees (max 3 par message). La
-- vision Claude consomme des tokens 5-10x plus chers que le texte. Sans
-- visibilite, une org peut consommer des milliers d'EUR sans s'en rendre compte.
--
-- VisionTokenUsageService calcule l'usage 30j glissants en queryant
-- assistant_message (prompt_tokens sur les messages avec attachments != NULL).
-- VisionUsageAlertScheduler (cron hebdo) compare a threshold_tokens : si depasse
-- ET last_alerted_at non recente, envoie une notification admin via
-- NotificationService.
--
-- Une seule ligne par org_id (UNIQUE). Si pas de ligne pour l'org, aucune
-- alerte n'est envoyee (opt-in explicite par l'admin).
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_vision_alerts (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL UNIQUE
        REFERENCES organization(id) ON DELETE CASCADE,
    threshold_tokens BIGINT NOT NULL,
    last_alerted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_threshold_positive CHECK (threshold_tokens > 0)
);

COMMENT ON TABLE org_vision_alerts IS
    'Configuration des alertes admin quand l''usage vision (tokens) depasse un seuil.';
COMMENT ON COLUMN org_vision_alerts.threshold_tokens IS
    'Seuil mensuel (30j glissants) declenchant l''alerte. Ex: 5_000_000 tokens ~ 50-150 EUR selon le modele.';
COMMENT ON COLUMN org_vision_alerts.last_alerted_at IS
    'Dernier envoi d''alerte. Evite le spam : on n''alerte pas deux fois en moins de 7 jours.';
