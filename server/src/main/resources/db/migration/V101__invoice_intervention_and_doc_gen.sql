-- V101: Add intervention_id, document_generation_id, duplicate_of_id to invoices
-- Supports auto-invoice generation for interventions and linking to DocumentGeneration PDFs

ALTER TABLE invoices ADD COLUMN intervention_id BIGINT;
ALTER TABLE invoices ADD COLUMN document_generation_id BIGINT;
ALTER TABLE invoices ADD COLUMN duplicate_of_id BIGINT;

CREATE INDEX idx_invoice_intervention ON invoices(intervention_id);
CREATE INDEX idx_invoice_doc_gen ON invoices(document_generation_id);
