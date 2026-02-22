package com.clenzy.model;

/**
 * Types d'evenements de securite traces dans security_audit_log.
 * Exigence Airbnb Partner Niveau 7.
 */
public enum SecurityAuditEventType {
    LOGIN_SUCCESS,
    LOGIN_FAILURE,
    PERMISSION_DENIED,
    DATA_ACCESS,
    ADMIN_ACTION,
    SECRET_ROTATION,
    SUSPICIOUS_ACTIVITY
}
