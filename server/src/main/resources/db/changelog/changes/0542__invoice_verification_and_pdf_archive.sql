-- Tables vérifiées contre Invoice (@Table invoices) et DocumentGeneration (document_generations).
ALTER TABLE template_compliance_reports ADD COLUMN country_code VARCHAR(2), ADD COLUMN source_hash VARCHAR(64);
CREATE TABLE baitly_invoice_reviews (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    invoice_id BIGINT NOT NULL REFERENCES invoices(id),
    source_hash VARCHAR(64) NOT NULL,
    version VARCHAR(64) NOT NULL,
    state VARCHAR(32) NOT NULL,
    issues TEXT NOT NULL,
    actor VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_baitly_invoice_reviews_latest ON baitly_invoice_reviews(organization_id,invoice_id,id DESC);
CREATE TABLE baitly_invoice_pdf_archives (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    invoice_id BIGINT NOT NULL REFERENCES invoices(id),
    source_hash VARCHAR(64) NOT NULL,
    document_hash VARCHAR(64) NOT NULL,
    content BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(organization_id,invoice_id)
);
CREATE FUNCTION baitly_document_evidence_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Baitly document evidence is immutable';
END;
$$;
CREATE TRIGGER baitly_invoice_reviews_immutable BEFORE UPDATE OR DELETE ON baitly_invoice_reviews
    FOR EACH ROW EXECUTE FUNCTION baitly_document_evidence_immutable();
CREATE TRIGGER baitly_invoice_pdf_archives_immutable BEFORE UPDATE OR DELETE ON baitly_invoice_pdf_archives
    FOR EACH ROW EXECUTE FUNCTION baitly_document_evidence_immutable();
