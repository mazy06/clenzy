-- V63 : Tables pour l'inbox unifie multi-canal (conversations + messages)

CREATE TABLE conversations (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    guest_id        BIGINT,
    property_id     BIGINT,
    reservation_id  BIGINT,
    channel         VARCHAR(20) NOT NULL DEFAULT 'INTERNAL',
    external_conversation_id VARCHAR(255),
    status          VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    subject         VARCHAR(500),
    last_message_preview TEXT,
    last_message_at TIMESTAMP,
    assigned_to_keycloak_id VARCHAR(255),
    unread          BOOLEAN NOT NULL DEFAULT TRUE,
    message_count   INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_conv_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_conv_guest FOREIGN KEY (guest_id) REFERENCES guests(id),
    CONSTRAINT fk_conv_property FOREIGN KEY (property_id) REFERENCES properties(id),
    CONSTRAINT fk_conv_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id),
    CONSTRAINT chk_conv_channel CHECK (channel IN ('AIRBNB','BOOKING','WHATSAPP','EMAIL','SMS','INTERNAL')),
    CONSTRAINT chk_conv_status CHECK (status IN ('OPEN','CLOSED','ARCHIVED'))
);

CREATE INDEX idx_conv_org ON conversations(organization_id);
CREATE INDEX idx_conv_guest ON conversations(guest_id);
CREATE INDEX idx_conv_property ON conversations(property_id);
CREATE INDEX idx_conv_reservation ON conversations(reservation_id);
CREATE INDEX idx_conv_status ON conversations(organization_id, status);
CREATE INDEX idx_conv_last_msg ON conversations(organization_id, last_message_at DESC);
CREATE INDEX idx_conv_assigned ON conversations(assigned_to_keycloak_id);
CREATE UNIQUE INDEX idx_conv_external ON conversations(organization_id, channel, external_conversation_id) WHERE external_conversation_id IS NOT NULL;

CREATE TABLE conversation_messages (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    conversation_id BIGINT NOT NULL,
    direction       VARCHAR(10) NOT NULL DEFAULT 'INBOUND',
    channel_source  VARCHAR(20) NOT NULL,
    sender_name     VARCHAR(255),
    sender_identifier VARCHAR(500),
    content         TEXT,
    content_html    TEXT,
    metadata        JSONB,
    attachments     JSONB,
    external_message_id VARCHAR(255),
    delivery_status VARCHAR(20) DEFAULT 'SENT',
    sent_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    read_at         TIMESTAMP,

    CONSTRAINT fk_cmsg_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_cmsg_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT chk_cmsg_direction CHECK (direction IN ('INBOUND','OUTBOUND')),
    CONSTRAINT chk_cmsg_channel CHECK (channel_source IN ('AIRBNB','BOOKING','WHATSAPP','EMAIL','SMS','INTERNAL'))
);

CREATE INDEX idx_cmsg_conv ON conversation_messages(conversation_id);
CREATE INDEX idx_cmsg_org ON conversation_messages(organization_id);
CREATE INDEX idx_cmsg_sent ON conversation_messages(conversation_id, sent_at DESC);
