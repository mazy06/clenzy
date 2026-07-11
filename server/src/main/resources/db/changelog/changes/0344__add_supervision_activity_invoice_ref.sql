-- Constellation : rattache une entree de journal a une facture (relances de paiement).
-- Pose par InvoiceReminderExecutor (agent Finance) afin d'ouvrir depuis le feed une
-- modale de detail de la facture (montant, echeance, rattachement reservation/intervention)
-- avec actions payer / envoyer un lien de paiement. NULL pour toutes les autres activites.
-- Miroir exact du pattern message_log_id (0343).
ALTER TABLE supervision_activity
    ADD COLUMN IF NOT EXISTS invoice_id BIGINT;

COMMENT ON COLUMN supervision_activity.invoice_id IS
    'Reference optionnelle vers invoices (relances de paiement uniquement). NULL sinon';
