-- Nature de la facture : GUEST (séjour, client) | COMMISSION (commission de gestion, propriétaire).
-- Les factures existantes sont toutes des factures de séjour → GUEST par défaut (aucun changement).
-- Permet à une réservation de porter à la fois une facture GUEST et une facture COMMISSION
-- (cas CONCIERGE_COLLECTS), l'unicité se résolvant par (reservation_id, invoice_type).
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(20) NOT NULL DEFAULT 'GUEST';

CREATE INDEX IF NOT EXISTS idx_invoice_type ON invoices (invoice_type);
