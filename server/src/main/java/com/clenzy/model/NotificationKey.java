package com.clenzy.model;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Enumeration de toutes les cles de notification du systeme Clenzy PMS.
 * Chaque cle porte son type par defaut, sa categorie et si elle est activee par defaut.
 */
public enum NotificationKey {

    // ─── INTERVENTION (18 cles) ─────────────────────────────────────────────────

    INTERVENTION_CREATED(NotificationType.INFO, NotificationCategory.INTERVENTION, true),
    INTERVENTION_UPDATED(NotificationType.INFO, NotificationCategory.INTERVENTION, true),
    INTERVENTION_ASSIGNED_TO_USER(NotificationType.INFO, NotificationCategory.INTERVENTION, true),
    INTERVENTION_ASSIGNED_TO_TEAM(NotificationType.INFO, NotificationCategory.INTERVENTION, true),
    INTERVENTION_STARTED(NotificationType.INFO, NotificationCategory.INTERVENTION, true),
    INTERVENTION_PROGRESS_UPDATED(NotificationType.INFO, NotificationCategory.INTERVENTION, true),
    INTERVENTION_COMPLETED(NotificationType.SUCCESS, NotificationCategory.INTERVENTION, true),
    INTERVENTION_REOPENED(NotificationType.WARNING, NotificationCategory.INTERVENTION, true),
    INTERVENTION_STATUS_CHANGED(NotificationType.INFO, NotificationCategory.INTERVENTION, true),
    INTERVENTION_VALIDATED(NotificationType.SUCCESS, NotificationCategory.INTERVENTION, true),
    INTERVENTION_AWAITING_VALIDATION(NotificationType.INFO, NotificationCategory.INTERVENTION, true),
    INTERVENTION_AWAITING_PAYMENT(NotificationType.WARNING, NotificationCategory.INTERVENTION, true),
    INTERVENTION_CANCELLED(NotificationType.WARNING, NotificationCategory.INTERVENTION, true),
    INTERVENTION_DELETED(NotificationType.WARNING, NotificationCategory.INTERVENTION, true),
    INTERVENTION_PHOTOS_ADDED(NotificationType.INFO, NotificationCategory.INTERVENTION, false),
    INTERVENTION_NOTES_UPDATED(NotificationType.INFO, NotificationCategory.INTERVENTION, false),
    INTERVENTION_OVERDUE(NotificationType.ERROR, NotificationCategory.INTERVENTION, true),
    INTERVENTION_REMINDER(NotificationType.INFO, NotificationCategory.INTERVENTION, true),

    // ─── SERVICE REQUEST (8 cles) ───────────────────────────────────────────────

    SERVICE_REQUEST_CREATED(NotificationType.INFO, NotificationCategory.SERVICE_REQUEST, true),
    SERVICE_REQUEST_UPDATED(NotificationType.INFO, NotificationCategory.SERVICE_REQUEST, true),
    SERVICE_REQUEST_APPROVED(NotificationType.SUCCESS, NotificationCategory.SERVICE_REQUEST, true),
    SERVICE_REQUEST_REJECTED(NotificationType.WARNING, NotificationCategory.SERVICE_REQUEST, true),
    SERVICE_REQUEST_INTERVENTION_CREATED(NotificationType.SUCCESS, NotificationCategory.SERVICE_REQUEST, true),
    SERVICE_REQUEST_ASSIGNED(NotificationType.INFO, NotificationCategory.SERVICE_REQUEST, true),
    SERVICE_REQUEST_CANCELLED(NotificationType.WARNING, NotificationCategory.SERVICE_REQUEST, true),
    SERVICE_REQUEST_URGENT(NotificationType.ERROR, NotificationCategory.SERVICE_REQUEST, true),

    // ─── PAYMENT (10 cles) ──────────────────────────────────────────────────────

    PAYMENT_SESSION_CREATED(NotificationType.INFO, NotificationCategory.PAYMENT, true),
    PAYMENT_CONFIRMED(NotificationType.SUCCESS, NotificationCategory.PAYMENT, true),
    PAYMENT_FAILED(NotificationType.ERROR, NotificationCategory.PAYMENT, true),
    PAYMENT_GROUPED_SESSION_CREATED(NotificationType.INFO, NotificationCategory.PAYMENT, true),
    PAYMENT_GROUPED_CONFIRMED(NotificationType.SUCCESS, NotificationCategory.PAYMENT, true),
    PAYMENT_GROUPED_FAILED(NotificationType.ERROR, NotificationCategory.PAYMENT, true),
    PAYMENT_DEFERRED_REMINDER(NotificationType.WARNING, NotificationCategory.PAYMENT, true),
    PAYMENT_DEFERRED_OVERDUE(NotificationType.ERROR, NotificationCategory.PAYMENT, true),
    PAYMENT_REFUND_INITIATED(NotificationType.INFO, NotificationCategory.PAYMENT, true),
    PAYMENT_REFUND_COMPLETED(NotificationType.SUCCESS, NotificationCategory.PAYMENT, true),

    // ─── ICAL (6 cles) ─────────────────────────────────────────────────────────

    ICAL_IMPORT_SUCCESS(NotificationType.SUCCESS, NotificationCategory.SYSTEM, true),
    ICAL_IMPORT_PARTIAL(NotificationType.WARNING, NotificationCategory.SYSTEM, true),
    ICAL_IMPORT_FAILED(NotificationType.ERROR, NotificationCategory.SYSTEM, true),
    ICAL_SYNC_COMPLETED(NotificationType.INFO, NotificationCategory.SYSTEM, false),
    ICAL_FEED_DELETED(NotificationType.INFO, NotificationCategory.SYSTEM, true),
    ICAL_AUTO_INTERVENTIONS_TOGGLED(NotificationType.INFO, NotificationCategory.SYSTEM, true),

    // ─── TEAM (8 cles) ─────────────────────────────────────────────────────────

    TEAM_CREATED(NotificationType.INFO, NotificationCategory.TEAM, true),
    TEAM_UPDATED(NotificationType.INFO, NotificationCategory.TEAM, true),
    TEAM_DELETED(NotificationType.WARNING, NotificationCategory.TEAM, true),
    TEAM_MEMBER_ADDED(NotificationType.INFO, NotificationCategory.TEAM, true),
    TEAM_MEMBER_REMOVED(NotificationType.WARNING, NotificationCategory.TEAM, true),
    TEAM_ASSIGNED_INTERVENTION(NotificationType.INFO, NotificationCategory.TEAM, true),
    TEAM_ROLE_CHANGED(NotificationType.INFO, NotificationCategory.TEAM, true),
    TEAM_MEMBER_JOINED(NotificationType.SUCCESS, NotificationCategory.TEAM, true),

    // ─── PORTFOLIO (6 cles) ─────────────────────────────────────────────────────

    PORTFOLIO_CREATED(NotificationType.INFO, NotificationCategory.SYSTEM, true),
    PORTFOLIO_CLIENT_ADDED(NotificationType.INFO, NotificationCategory.SYSTEM, true),
    PORTFOLIO_CLIENT_REMOVED(NotificationType.WARNING, NotificationCategory.SYSTEM, true),
    PORTFOLIO_TEAM_MEMBER_ADDED(NotificationType.INFO, NotificationCategory.SYSTEM, true),
    PORTFOLIO_TEAM_MEMBER_REMOVED(NotificationType.WARNING, NotificationCategory.SYSTEM, true),
    PORTFOLIO_UPDATED(NotificationType.INFO, NotificationCategory.SYSTEM, false),

    // ─── USER (5 cles) ─────────────────────────────────────────────────────────

    USER_CREATED(NotificationType.SUCCESS, NotificationCategory.SYSTEM, true),
    USER_UPDATED(NotificationType.INFO, NotificationCategory.SYSTEM, false),
    USER_DELETED(NotificationType.WARNING, NotificationCategory.SYSTEM, true),
    USER_ROLE_CHANGED(NotificationType.WARNING, NotificationCategory.SYSTEM, true),
    USER_DEACTIVATED(NotificationType.WARNING, NotificationCategory.SYSTEM, true),

    // ─── GDPR (3 cles) ─────────────────────────────────────────────────────────

    GDPR_DATA_EXPORTED(NotificationType.INFO, NotificationCategory.SYSTEM, true),
    GDPR_USER_ANONYMIZED(NotificationType.WARNING, NotificationCategory.SYSTEM, true),
    GDPR_CONSENTS_UPDATED(NotificationType.INFO, NotificationCategory.SYSTEM, true),

    // ─── PERMISSION (2 cles) ────────────────────────────────────────────────────

    PERMISSION_ROLE_UPDATED(NotificationType.WARNING, NotificationCategory.SYSTEM, true),
    PERMISSION_CACHE_INVALIDATED(NotificationType.INFO, NotificationCategory.SYSTEM, false),

    // ─── PROPERTY (4 cles) ──────────────────────────────────────────────────────

    PROPERTY_CREATED(NotificationType.SUCCESS, NotificationCategory.SYSTEM, true),
    PROPERTY_UPDATED(NotificationType.INFO, NotificationCategory.SYSTEM, false),
    PROPERTY_DELETED(NotificationType.WARNING, NotificationCategory.SYSTEM, true),
    PROPERTY_STATUS_CHANGED(NotificationType.INFO, NotificationCategory.SYSTEM, true),

    // ─── CONTACT (6 cles) ─────────────────────────────────────────────────────

    CONTACT_MESSAGE_RECEIVED(NotificationType.INFO, NotificationCategory.CONTACT, true),
    CONTACT_MESSAGE_SENT(NotificationType.SUCCESS, NotificationCategory.CONTACT, true),
    CONTACT_MESSAGE_REPLIED(NotificationType.INFO, NotificationCategory.CONTACT, true),
    CONTACT_MESSAGE_ARCHIVED(NotificationType.INFO, NotificationCategory.CONTACT, false),
    CONTACT_FORM_RECEIVED(NotificationType.WARNING, NotificationCategory.CONTACT, true),
    CONTACT_FORM_STATUS_CHANGED(NotificationType.INFO, NotificationCategory.CONTACT, false),

    // ─── DOCUMENT (4 cles) ──────────────────────────────────────────────────────

    DOCUMENT_GENERATED(NotificationType.SUCCESS, NotificationCategory.DOCUMENT, true),
    DOCUMENT_GENERATION_FAILED(NotificationType.ERROR, NotificationCategory.DOCUMENT, true),
    DOCUMENT_TEMPLATE_UPLOADED(NotificationType.INFO, NotificationCategory.DOCUMENT, false),
    DOCUMENT_SENT_BY_EMAIL(NotificationType.SUCCESS, NotificationCategory.DOCUMENT, true);

    // Total: 18 + 8 + 10 + 6 + 8 + 6 + 5 + 3 + 2 + 4 + 6 + 4 = 80

    private final NotificationType defaultType;
    private final NotificationCategory category;
    private final boolean enabledByDefault;

    NotificationKey(NotificationType defaultType, NotificationCategory category, boolean enabledByDefault) {
        this.defaultType = defaultType;
        this.category = category;
        this.enabledByDefault = enabledByDefault;
    }

    public NotificationType getDefaultType() {
        return defaultType;
    }

    public NotificationCategory getCategory() {
        return category;
    }

    public boolean isEnabledByDefault() {
        return enabledByDefault;
    }

    @JsonValue
    public String toValue() {
        return name();
    }
}
