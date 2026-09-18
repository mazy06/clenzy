-- File durable et archive privée Baitly, gérées en JDBC (sans entité JPA).
-- Référence vérifiée contre ServiceQuoteAmendment et le changeset 0442.
CREATE TABLE service_quote_amendment_archives (
    amendment_id BIGINT PRIMARY KEY REFERENCES service_quote_amendments(id),
    organization_id BIGINT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RUNNING','READY')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    lease_token UUID,
    lease_until TIMESTAMPTZ,
    pdf_content BYTEA,
    sha256 VARCHAR(64),
    archived_at TIMESTAMPTZ,
    CHECK ((status = 'RUNNING' AND lease_token IS NOT NULL AND lease_until IS NOT NULL)
        OR (status <> 'RUNNING' AND lease_token IS NULL AND lease_until IS NULL)),
    CHECK ((status = 'READY' AND pdf_content IS NOT NULL AND octet_length(pdf_content) BETWEEN 5 AND 5242880
            AND sha256 IS NOT NULL AND length(sha256) = 64 AND archived_at IS NOT NULL)
        OR (status <> 'READY' AND pdf_content IS NULL AND sha256 IS NULL AND archived_at IS NULL))
);
CREATE INDEX idx_amendment_archives_pending ON service_quote_amendment_archives(retry_at, amendment_id) WHERE status = 'PENDING';
CREATE INDEX idx_amendment_archives_running ON service_quote_amendment_archives(lease_until, amendment_id) WHERE status = 'RUNNING';
CREATE INDEX idx_amendments_accepted_archive ON service_quote_amendments(id) WHERE status = 'ACCEPTED';

-- Reprise des décisions acceptées avant l'introduction de l'archivage.
INSERT INTO service_quote_amendment_archives(amendment_id, organization_id)
SELECT id, organization_id FROM service_quote_amendments WHERE status = 'ACCEPTED';
