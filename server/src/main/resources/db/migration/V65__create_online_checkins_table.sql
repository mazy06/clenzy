-- V65 : Online check-in pour les voyageurs

CREATE TABLE online_checkins (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    reservation_id  BIGINT NOT NULL,
    token           UUID NOT NULL DEFAULT gen_random_uuid(),
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    first_name      VARCHAR(500),
    last_name       VARCHAR(500),
    email           VARCHAR(500),
    phone           VARCHAR(500),
    id_document_number VARCHAR(500),
    id_document_type VARCHAR(50),
    id_document_file_path VARCHAR(1000),
    estimated_arrival_time VARCHAR(10),
    special_requests TEXT,
    number_of_guests INT,
    additional_guests JSONB,
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP,
    expires_at      TIMESTAMP NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_oci_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_oci_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id),
    CONSTRAINT chk_oci_status CHECK (status IN ('PENDING','STARTED','COMPLETED','EXPIRED'))
);

CREATE UNIQUE INDEX idx_oci_token ON online_checkins(token);
CREATE INDEX idx_oci_org ON online_checkins(organization_id);
CREATE INDEX idx_oci_reservation ON online_checkins(reservation_id);
CREATE INDEX idx_oci_status ON online_checkins(status);
