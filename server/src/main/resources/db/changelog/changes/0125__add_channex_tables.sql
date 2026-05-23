-- ============================================================================
-- 0125 : Channex Channel Manager — mapping tables
-- ============================================================================
-- Tables de mapping entre les properties Clenzy et les properties Channex,
-- avec gestion fine des channels OTA actives par propriete.
--
-- Reference plan : docs/strategy/channex-integration-plan.md (Sprint 2)
-- ============================================================================

-- ─── Mapping Clenzy property <-> Channex property ───────────────────────────
CREATE TABLE channex_property_mapping (
    id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id               BIGINT NOT NULL,
    clenzy_property_id            BIGINT NOT NULL,
    channex_property_id           VARCHAR(64) NOT NULL,
    channex_room_type_id          VARCHAR(64) NOT NULL,
    channex_default_rate_plan_id  VARCHAR(64) NOT NULL,
    sync_status                   VARCHAR(20) NOT NULL DEFAULT 'pending',
        -- pending | active | error | disabled
    last_sync_at                  TIMESTAMP WITH TIME ZONE,
    last_sync_error               TEXT,
    created_at                    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_channex_mapping_property
        FOREIGN KEY (clenzy_property_id) REFERENCES properties(id) ON DELETE CASCADE,
    CONSTRAINT uq_channex_mapping_clenzy_prop
        UNIQUE (clenzy_property_id, organization_id),
    CONSTRAINT uq_channex_mapping_channex_prop
        UNIQUE (channex_property_id, organization_id),
    CONSTRAINT chk_channex_mapping_sync_status
        CHECK (sync_status IN ('pending', 'active', 'error', 'disabled'))
);

CREATE INDEX idx_channex_mapping_org ON channex_property_mapping(organization_id);
CREATE INDEX idx_channex_mapping_clenzy_prop ON channex_property_mapping(clenzy_property_id);
CREATE INDEX idx_channex_mapping_status ON channex_property_mapping(sync_status)
    WHERE sync_status IN ('pending', 'error');

COMMENT ON TABLE channex_property_mapping IS
    'Mapping bidirectionnel Clenzy.Property <-> Channex.Property. Une property Clenzy correspond a une property + room_type + rate_plan dans Channex.';
COMMENT ON COLUMN channex_property_mapping.sync_status IS
    'Etat de la sync : pending (creation en cours), active (sync normale), error (erreur, voir last_sync_error), disabled (sync manuellement desactivee).';

-- ─── Channels OTA actifs par mapping ────────────────────────────────────────
-- Une property Channex peut etre connectee a plusieurs OTAs (Airbnb + Booking + Vrbo).
-- Chaque connexion = un "Channel" dans Channex.
CREATE TABLE channex_ota_channels (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_mapping_id      UUID NOT NULL,
    organization_id          BIGINT NOT NULL,
    ota_type                 VARCHAR(40) NOT NULL,
        -- 'airbnb', 'booking_com', 'vrbo', 'expedia', 'agoda', 'tripadvisor',
        -- 'hometogo', 'tripcom', 'hotelscom', 'almosafer' ...
    channex_channel_id       VARCHAR(64) NOT NULL,
    enabled                  BOOLEAN NOT NULL DEFAULT TRUE,
    last_push_at             TIMESTAMP WITH TIME ZONE,
    last_pull_at             TIMESTAMP WITH TIME ZONE,
    error_count              INT NOT NULL DEFAULT 0,
    last_error_message       TEXT,
    created_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_channex_ota_mapping
        FOREIGN KEY (property_mapping_id) REFERENCES channex_property_mapping(id) ON DELETE CASCADE,
    CONSTRAINT uq_channex_ota_per_mapping
        UNIQUE (property_mapping_id, ota_type)
);

CREATE INDEX idx_channex_ota_mapping ON channex_ota_channels(property_mapping_id);
CREATE INDEX idx_channex_ota_org ON channex_ota_channels(organization_id);
CREATE INDEX idx_channex_ota_enabled ON channex_ota_channels(enabled)
    WHERE enabled = TRUE;

COMMENT ON TABLE channex_ota_channels IS
    'Channels OTA actives pour une property Clenzy via Channex (Airbnb + Booking + Vrbo + ...).';
COMMENT ON COLUMN channex_ota_channels.ota_type IS
    'Slug OTA cote Channex (ex: airbnb, booking_com, vrbo, expedia). Mapping a tenir a jour avec la documentation Channex.';
