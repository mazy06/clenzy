-- ============================================================================
-- 0063 : Add hidden_from_planning to reservations
-- ============================================================================
-- Allows cancelled reservations to be hidden from the planning view
-- without deleting them from the database.
-- ============================================================================

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS hidden_from_planning BOOLEAN NOT NULL DEFAULT FALSE;
