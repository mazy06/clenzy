-- Baitly : montant choisi par logement et figé pour chaque nouvelle réservation.
ALTER TABLE properties ADD COLUMN security_deposit_amount numeric(12,2) NOT NULL DEFAULT 0
    CHECK (security_deposit_amount >= 0);
ALTER TABLE reservations ADD COLUMN security_deposit_amount numeric(12,2)
    CHECK (security_deposit_amount IS NULL OR security_deposit_amount >= 0);

-- États durables avant les appels PSP : aucune capture concurrente d'une caution en libération.
ALTER TABLE security_deposits ADD COLUMN operation_amount numeric(12,2);
ALTER TABLE security_deposits ADD COLUMN operation_reason varchar(512);
ALTER TABLE security_deposits DROP CONSTRAINT IF EXISTS security_deposits_status_check;
ALTER TABLE security_deposits ADD CONSTRAINT ck_baitly_security_deposit_status
    CHECK (status IN ('PENDING','HELD','RELEASING','CAPTURING','RELEASED','CAPTURED','FAILED','EXPIRED'));
