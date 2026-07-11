-- Autonomie constellation (Vague 1) — toggles d'auto-application PAR TYPE d'action.
--
-- Une ligne par (org, action_type) : enabled (defaut FALSE = opt-in total, aucun
-- seed actif), level (NOTIFY = auto + notification annulable, FULL = auto silencieux
-- + feed) et enveloppe JSON editable (bornes d'auto-application par type ; NULL =
-- defauts Java documentes dans AutoApplyGate). Le niveau du module
-- (supervision_module_settings.autonomy_level) reste le PLAFOND : la regle ne peut
-- jamais depasser le niveau de l'agent.
CREATE TABLE IF NOT EXISTS supervision_auto_rules (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT      NOT NULL,
    action_type     VARCHAR(40) NOT NULL,
    enabled         BOOLEAN     NOT NULL DEFAULT FALSE,
    level           VARCHAR(20) NOT NULL DEFAULT 'NOTIFY',
    envelope        TEXT,
    created_at      TIMESTAMP   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP,
    CONSTRAINT ux_supervision_auto_rules_org_type UNIQUE (organization_id, action_type)
);

COMMENT ON TABLE supervision_auto_rules IS
    'Autonomie constellation V1 : toggle + niveau (NOTIFY|FULL) + enveloppe JSON par type d''action. Opt-in total (aucun seed).';

-- Tracabilite de l'auteur d'une application de carte : 'user:<keycloakId>' (bouton
-- humain) vs 'auto:gate' (auto-application par l'AutoApplyGate). NULL = applique
-- avant cette migration (auteur inconnu) ou carte non appliquee.
ALTER TABLE supervision_suggestion ADD COLUMN IF NOT EXISTS applied_by VARCHAR(80);

COMMENT ON COLUMN supervision_suggestion.applied_by IS
    'Auteur de l''application : user:<keycloakId> ou auto:gate. NULL = non appliquee / historique.';
