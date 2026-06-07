-- Relais WhatsApp entrant : retrouver un guest depuis son numero de telephone.
-- phone_hash = SHA-256 du numero normalise E.164. Le `phone` lui-meme est chiffre
-- (AES), donc non recherchable en SQL. Index NON unique : un meme numero peut
-- exister dans plusieurs organisations (compte WhatsApp global => lookup cross-org).
--
-- Peuplement des guests EXISTANTS : fait par un runner Java idempotent au boot
-- (GuestPhoneHashBackfillRunner) car le phone chiffre ne peut pas etre hashe en
-- SQL natif (contrairement a email_hash des users, cf. 0039).

ALTER TABLE guests ADD COLUMN IF NOT EXISTS phone_hash VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_guests_phone_hash ON guests (phone_hash);
