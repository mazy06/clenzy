-- Baitly : l'audit existant est append-only et protégé par la politique RLS du journal.
ALTER TABLE payout_transfer_events ADD COLUMN origin varchar(30) NOT NULL DEFAULT 'AUTOMATIC';
ALTER TABLE payout_transfer_events ADD COLUMN actor_subject varchar(255);
ALTER TABLE payout_transfer_events ADD CONSTRAINT payout_event_origin_check CHECK (
    (origin = 'AUTOMATIC' AND actor_subject IS NULL)
    OR (origin = 'RECONCILIATION' AND nullif(trim(actor_subject),'') IS NOT NULL
        AND state = 'TRANSFERRED' AND external_reference IS NOT NULL)
);
CREATE UNIQUE INDEX uq_payout_reconciliation_audit ON payout_transfer_events(transfer_id)
    WHERE origin = 'RECONCILIATION';
