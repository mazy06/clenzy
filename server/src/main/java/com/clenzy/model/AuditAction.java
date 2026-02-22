package com.clenzy.model;

/**
 * Types d'actions traçables dans l'audit log.
 */
public enum AuditAction {
    CREATE,
    READ,
    UPDATE,
    DELETE,
    LOGIN,
    LOGOUT,
    LOGIN_FAILED,
    SYNC,
    EXPORT,
    IMPORT,
    PERMISSION_CHANGE,
    STATUS_CHANGE,
    PAYMENT,
    WEBHOOK_RECEIVED,
    DOCUMENT_GENERATE,
    DOCUMENT_LOCK,
    DOCUMENT_VERIFY,
    DOCUMENT_CORRECT,
    COMPLIANCE_CHECK,
    RECONCILIATION
}
