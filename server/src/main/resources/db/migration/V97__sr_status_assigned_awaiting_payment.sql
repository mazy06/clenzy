-- V97: Simplify service_requests status enum
-- Remove legacy APPROVED and DEVIS_ACCEPTED statuses
-- New workflow: PENDING -> ASSIGNED -> AWAITING_PAYMENT -> IN_PROGRESS -> COMPLETED

-- Drop the existing auto-generated check constraint
ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_status_check;

-- Recreate with simplified statuses (7 values)
ALTER TABLE service_requests ADD CONSTRAINT service_requests_status_check
    CHECK (status IN (
        'PENDING',
        'ASSIGNED',
        'AWAITING_PAYMENT',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
        'REJECTED'
    ));

-- Migrate any existing rows with legacy statuses to the new workflow
UPDATE service_requests SET status = 'ASSIGNED' WHERE status = 'APPROVED';
UPDATE service_requests SET status = 'ASSIGNED' WHERE status = 'DEVIS_ACCEPTED';
