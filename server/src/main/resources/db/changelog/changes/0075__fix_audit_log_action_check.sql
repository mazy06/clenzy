-- Fix audit_log_action_check constraint to include all AuditAction enum values
-- COMPLIANCE_CHECK and RECONCILIATION were missing from the constraint

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;

ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check
    CHECK (action IN (
        'CREATE', 'READ', 'UPDATE', 'DELETE',
        'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
        'SYNC', 'EXPORT', 'IMPORT',
        'PERMISSION_CHANGE', 'STATUS_CHANGE',
        'PAYMENT', 'WEBHOOK_RECEIVED',
        'DOCUMENT_GENERATE', 'DOCUMENT_LOCK', 'DOCUMENT_VERIFY', 'DOCUMENT_CORRECT',
        'COMPLIANCE_CHECK', 'RECONCILIATION'
    ));
