CREATE TABLE baitly_sale_documents (
 id BIGSERIAL PRIMARY KEY, organization_id BIGINT NOT NULL, source VARCHAR(255) NOT NULL,
 source_id BIGINT, source_ref VARCHAR(255) NOT NULL, refund_ref VARCHAR(255) NOT NULL DEFAULT '',
 state VARCHAR(255) NOT NULL DEFAULT 'PENDING', first_attempt_at TIMESTAMPTZ,
 retry_at TIMESTAMPTZ NOT NULL DEFAULT now(), checked_at TIMESTAMPTZ, lease_token UUID,
 provider_account VARCHAR(255), provider_ref VARCHAR(255), number VARCHAR(255), currency VARCHAR(255),
 net_cents BIGINT, total_cents BIGINT, pdf_url TEXT, issued_at TIMESTAMPTZ, snapshot JSONB, failure VARCHAR(255),
 CONSTRAINT uq_baitly_sale_document UNIQUE (organization_id,source_ref,refund_ref),
 CONSTRAINT uq_baitly_sale_document_psp UNIQUE (provider_account,provider_ref),
 CHECK (source IN ('SUBSCRIPTION','AI_CREDIT_TOPUP','HARDWARE_ORDER')),
 CHECK (state IN ('PENDING','PROCESSING','REVIEW_REQUIRED','READY')),
 CHECK (net_cents IS NULL OR (net_cents>=0 AND total_cents>=net_cents)),
 CHECK (state<>'READY' OR (provider_account IS NOT NULL AND provider_ref IS NOT NULL AND number IS NOT NULL AND snapshot IS NOT NULL))
);
CREATE INDEX ix_baitly_sale_documents_queue ON baitly_sale_documents(retry_at);
CREATE OR REPLACE FUNCTION baitly_sale_document_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.provider_ref IS NOT NULL AND (TG_OP='DELETE' OR
   ROW(NEW.organization_id,NEW.source,NEW.source_id,NEW.source_ref,NEW.refund_ref,NEW.provider_account,NEW.provider_ref,NEW.number,NEW.currency,NEW.net_cents,NEW.total_cents,NEW.issued_at,NEW.snapshot)
   IS DISTINCT FROM ROW(OLD.organization_id,OLD.source,OLD.source_id,OLD.source_ref,OLD.refund_ref,OLD.provider_account,OLD.provider_ref,OLD.number,OLD.currency,OLD.net_cents,OLD.total_cents,OLD.issued_at,OLD.snapshot)) THEN
   RAISE EXCEPTION 'An issued Baitly document is immutable';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER baitly_sale_document_immutable BEFORE UPDATE OR DELETE ON baitly_sale_documents
 FOR EACH ROW EXECUTE FUNCTION baitly_sale_document_immutable();
