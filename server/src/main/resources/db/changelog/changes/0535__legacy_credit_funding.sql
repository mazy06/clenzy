ALTER TABLE ai_credit_grant ADD COLUMN IF NOT EXISTS funding_invoice_id VARCHAR(255);
ALTER TABLE ai_credit_grant ADD COLUMN IF NOT EXISTS funding_pending BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE ai_credit_grant SET funding_pending=TRUE
 WHERE source='SUBSCRIPTION' AND stripe_ref ~ '^monthly:[0-9]+:[0-9]{4}-[0-9]{2}$' AND funding_invoice_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_grant_funding_invoice ON ai_credit_grant(organization_id,funding_invoice_id);
