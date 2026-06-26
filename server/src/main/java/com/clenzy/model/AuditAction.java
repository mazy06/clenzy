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
    RECONCILIATION,
    /**
     * Execution d'un outil par l'assistant IA (mono-agent ou specialiste multi-agent).
     * Le detail (nom de l'outil, args tronques/PII-safe, resultat) est porte par les
     * champs entityType / details / newValue de l'AuditLog.
     */
    ASSISTANT_TOOL
}
