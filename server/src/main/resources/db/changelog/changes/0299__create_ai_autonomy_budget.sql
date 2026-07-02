-- Campagne multi-agent (X4, ADR-007 / D-105) : sous-budget d'autonomie premium.
-- Une enveloppe DEDIEE et PLAFONNEE pour l'autonomie proactive (analyses
-- predictives, rapports, optimisations lancees seules). Elle puise dans les
-- poches normales (ai_credit_grant) MAIS son cumul de cycle est borne par
-- premium_cap : au plafond, l'autonomie premium se met en pause ou repasse en
-- « notifier », SANS jamais grignoter les credits que le client reserve a
-- l'interactif. L'autonomie SOCLE (auto-reponses, alertes, briefing de base)
-- n'est PAS concernee : elle est debitee 0 credit (tracee au ledger).

CREATE TABLE ai_autonomy_budget (
    organization_id BIGINT PRIMARY KEY,
    premium_cap_millicredits BIGINT NOT NULL DEFAULT 0,      -- 0 = autonomie premium desactivee
    on_cap_behavior VARCHAR(16) NOT NULL DEFAULT 'NOTIFY_ONLY', -- PAUSE | NOTIFY_ONLY
    -- Toggles par comportement autonome premium (JSON : {"pricing_scan": true, ...}).
    behaviors JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by VARCHAR(64)
);
