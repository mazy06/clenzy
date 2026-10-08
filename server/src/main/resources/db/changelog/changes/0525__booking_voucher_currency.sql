-- Les anciens montants sans devise exigent une configuration explicite ; aucune conversion implicite.
ALTER TABLE booking_voucher ADD COLUMN currency VARCHAR(3);
ALTER TABLE booking_voucher ADD CONSTRAINT booking_voucher_currency_format CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$');
