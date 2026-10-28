-- Baitly: record only newly observed expiry before any attempt. No historical inference.
-- JDBC-owned tables and columns verified against 0601 and BaitlyNoiseDeliveryOutbox.
ALTER TABLE baitly_noise_delivery_items ADD COLUMN expired_unattempted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE baitly_noise_delivery_items ADD CONSTRAINT ck_baitly_noise_expired_unattempted
    CHECK (expired_unattempted=false OR (state='SKIPPED' AND attempt IS NULL));
