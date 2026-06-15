-- Durée du hold (minutes) avant annulation auto d'une réservation PENDING non payée, configurable
-- par org dans le Studio (booking engine). NULL = défaut système (30 min). Lu par
-- PendingReservationCleanupScheduler pour calculer l'expiration par organisation.
ALTER TABLE booking_engine_configs ADD COLUMN IF NOT EXISTS pending_hold_minutes INTEGER;
