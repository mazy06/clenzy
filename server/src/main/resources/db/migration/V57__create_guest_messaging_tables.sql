-- ============================================================================
-- V57 : Guest Messaging — Check-in Instructions, Message Templates,
--       Message Log, Automation Config, Auto-Push Pricing toggle
-- ============================================================================

-- ============================
-- 1. check_in_instructions (1 par propriete)
-- ============================
CREATE TABLE check_in_instructions (
    id                      BIGSERIAL PRIMARY KEY,
    organization_id         BIGINT NOT NULL REFERENCES organizations(id),
    property_id             BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    access_code             VARCHAR(200),
    wifi_name               VARCHAR(200),
    wifi_password           VARCHAR(200),
    parking_info            TEXT,
    arrival_instructions    TEXT,
    departure_instructions  TEXT,
    house_rules             TEXT,
    emergency_contact       VARCHAR(500),
    additional_notes        TEXT,
    created_at              TIMESTAMP NOT NULL DEFAULT now(),
    updated_at              TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_checkin_instructions_property UNIQUE (property_id)
);

CREATE INDEX idx_checkin_instructions_org ON check_in_instructions(organization_id);
CREATE INDEX idx_checkin_instructions_property ON check_in_instructions(property_id);

-- ============================
-- 2. message_templates (modeles d'email avec variables)
-- ============================
CREATE TABLE message_templates (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT NOT NULL REFERENCES organizations(id),
    name                VARCHAR(200) NOT NULL,
    type                VARCHAR(30) NOT NULL
                        CHECK (type IN ('CHECK_IN', 'CHECK_OUT', 'WELCOME', 'CUSTOM')),
    subject             VARCHAR(500) NOT NULL,
    body                TEXT NOT NULL,
    language            VARCHAR(5) NOT NULL DEFAULT 'fr',
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMP NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_templates_org ON message_templates(organization_id);
CREATE INDEX idx_message_templates_org_type ON message_templates(organization_id, type, is_active);

-- ============================
-- 3. guest_message_log (historique des envois)
-- ============================
CREATE TABLE guest_message_log (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT NOT NULL REFERENCES organizations(id),
    reservation_id      BIGINT NOT NULL REFERENCES reservations(id),
    guest_id            BIGINT REFERENCES guests(id),
    template_id         BIGINT REFERENCES message_templates(id) ON DELETE SET NULL,
    channel             VARCHAR(30) NOT NULL DEFAULT 'EMAIL'
                        CHECK (channel IN ('EMAIL', 'WHATSAPP', 'SMS')),
    recipient           VARCHAR(500) NOT NULL,
    subject             VARCHAR(500),
    status              VARCHAR(30) NOT NULL DEFAULT 'SENT'
                        CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED')),
    error_message       TEXT,
    sent_at             TIMESTAMP,
    created_at          TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_guest_message_log_org ON guest_message_log(organization_id);
CREATE INDEX idx_guest_message_log_reservation ON guest_message_log(reservation_id);
CREATE INDEX idx_guest_message_log_guest ON guest_message_log(guest_id) WHERE guest_id IS NOT NULL;
CREATE INDEX idx_guest_message_log_status ON guest_message_log(status, sent_at);

-- ============================
-- 4. messaging_automation_config (1 par organisation)
-- ============================
CREATE TABLE messaging_automation_config (
    id                          BIGSERIAL PRIMARY KEY,
    organization_id             BIGINT NOT NULL REFERENCES organizations(id),
    auto_send_check_in          BOOLEAN NOT NULL DEFAULT false,
    auto_send_check_out         BOOLEAN NOT NULL DEFAULT false,
    hours_before_check_in       INTEGER NOT NULL DEFAULT 24,
    hours_before_check_out      INTEGER NOT NULL DEFAULT 12,
    check_in_template_id        BIGINT REFERENCES message_templates(id) ON DELETE SET NULL,
    check_out_template_id       BIGINT REFERENCES message_templates(id) ON DELETE SET NULL,
    auto_push_pricing_enabled   BOOLEAN NOT NULL DEFAULT false,
    created_at                  TIMESTAMP NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_messaging_config_org UNIQUE (organization_id)
);

-- ============================
-- 5. Ajouter auto_push_pricing sur airbnb_listing_mappings
-- ============================
ALTER TABLE airbnb_listing_mappings
    ADD COLUMN IF NOT EXISTS auto_push_pricing BOOLEAN NOT NULL DEFAULT false;
