-- ============================================================================
-- 0122 : compliance_connections — declaration legale des voyageurs
-- ============================================================================
-- Automatisation de la declaration des guests aupres des autorites locales :
--   - France : fiche individuelle de police (CERFA 11253*04, obligatoire
--     pour les non-residents UE)
--   - Maroc : fiche d'identification voyageur (DGSN)
--   - Arabie Saoudite : enregistrement via Absher (MOI) + Tawakkalna
--
-- Providers scaffoldes :
--   - CHEKIN : SaaS, automatisation fiche police FR/ES/IT/PT (API key)
--   - POLICE_MA : connecteur direct DGSN Maroc (a cabler avec le portail
--     officiel quand l'organisme aura un partenariat formel — pour l'instant
--     stub stocke les credentials utiles a la declaration manuelle)
--   - ABSHER_KSA : connecteur direct Absher Arabie Saoudite (memes remarques)
--
-- Pourquoi sa propre table plutot que reutiliser external_service_connections :
--   - Domaine business different (compliance vs signature) -> SRP
--   - Pas de pollution de l'enum SignatureProviderType
--   - Future evolution : ajouter des champs metier (issuing_authority_id,
--     last_declaration_at, etc.) sans toucher aux autres domaines
-- ============================================================================

CREATE TABLE compliance_connections (
    id                    BIGSERIAL PRIMARY KEY,
    organization_id       BIGINT NOT NULL,
    user_id               BIGINT NOT NULL,
    provider_type         VARCHAR(30) NOT NULL,
    server_url            VARCHAR(500) NOT NULL,
    account_identifier    VARCHAR(200),
    api_key_encrypted     TEXT NOT NULL,
    status                VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    error_message         TEXT,
    last_tested_at        TIMESTAMP,
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT compliance_connections_status_check
        CHECK (status IN ('ACTIVE','ERROR','REVOKED')),
    CONSTRAINT compliance_connections_provider_check
        CHECK (provider_type IN ('CHEKIN','POLICE_MA','ABSHER_KSA'))
);

CREATE INDEX idx_compliance_conn_org
    ON compliance_connections (organization_id);

CREATE UNIQUE INDEX uq_compliance_conn_org_provider
    ON compliance_connections (organization_id, provider_type);
