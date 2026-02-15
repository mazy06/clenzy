-- ============================================================
-- V26 : Table des formulaires reçus (devis, maintenance, support)
-- ============================================================

CREATE TABLE received_forms (
    id              BIGSERIAL PRIMARY KEY,
    form_type       VARCHAR(20)  NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    phone           VARCHAR(50),
    city            VARCHAR(100),
    postal_code     VARCHAR(10),
    subject         VARCHAR(500),
    payload         JSONB        NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'NEW',
    ip_address      VARCHAR(50),
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    read_at         TIMESTAMP,
    processed_at    TIMESTAMP
);

CREATE INDEX idx_received_forms_type       ON received_forms(form_type);
CREATE INDEX idx_received_forms_status     ON received_forms(status);
CREATE INDEX idx_received_forms_created_at ON received_forms(created_at DESC);
