package com.clenzy.model;

/**
 * Source de l'action auditee.
 */
public enum AuditSource {
    WEB,
    API,
    ADMIN,
    AIRBNB_SYNC,
    SYSTEM,
    WEBHOOK,
    CRON,
    /** Action declenchee via l'assistant IA (tool calling). */
    ASSISTANT
}
