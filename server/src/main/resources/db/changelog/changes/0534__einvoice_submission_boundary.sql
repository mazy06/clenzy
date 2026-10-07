ALTER TABLE einvoice_submissions ADD COLUMN invoice_id BIGINT, ADD COLUMN document_hash VARCHAR(64),
 ADD COLUMN submission_started_at TIMESTAMPTZ, ADD COLUMN retry_at TIMESTAMPTZ;
CREATE INDEX ix_baitly_einvoice_pending ON einvoice_submissions(retry_at) WHERE submission_started_at IS NULL;
