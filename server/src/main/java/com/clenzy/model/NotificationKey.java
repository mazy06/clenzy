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
    SERVICE_REQUEST_NO_TEAM_AVAILABLE(NotificationType.WARNING, NotificationCategory.SERVICE_REQUEST, true),
    SERVICE_REQUEST_ESCALATION(NotificationType.ERROR, NotificationCategory.SERVICE_REQUEST, true),
    SERVICE_REQUEST_TEAM_ASSIGNED(NotificationType.SUCCESS, NotificationCategory.SERVICE_REQUEST, true),

    // ─── ANOMALIE TERRAIN / ISSUE (2 cles — Moteur Menage 3C) ──────────────────
    // ISSUE_REPORTED  : signalement terrain (housekeeper/technicien) — admins/managers org + owner.
    // ISSUE_CONVERTED : anomalie convertie en demande de maintenance pre-chiffree — owner.
    ISSUE_REPORTED(NotificationType.WARNING, NotificationCategory.SERVICE_REQUEST, true),
    ISSUE_CONVERTED(NotificationType.INFO, NotificationCategory.SERVICE_REQUEST, true),

    // ─── PAYMENT (10 cles) ──────────────────────────────────────────────────────

    PAYMENT_SESSION_CREATED(NotificationType.INFO, NotificationCategory.PAYMENT, true),
    // Moteur Ménage 3B (P9) — payout prestataire ménage.
    PAYOUT_SENT(NotificationType.SUCCESS, NotificationCategory.PAYMENT, true),
    PAYOUT_BLOCKED_ONBOARDING(NotificationType.WARNING, NotificationCategory.PAYMENT, true),
    // (PAYOUT_FAILED existe déjà — section payouts owners — et est réutilisé par le payout pro.)
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

    // ─── CHANNEX / CHANNEL MANAGER (2 cles) ────────────────────────────────────
    // Emises par ChannexWatchdogScheduler (Phase 3 — proactivite).
    // CHANNEX_SYNC_ERROR    : mapping passe en ERROR (transition vers cet etat)
    // CHANNEX_SYNC_RECOVERED: mapping etait en ERROR notifie, revient en ACTIVE

    CHANNEX_SYNC_ERROR(NotificationType.ERROR, NotificationCategory.SYSTEM, true),
    CHANNEX_SYNC_RECOVERED(NotificationType.SUCCESS, NotificationCategory.SYSTEM, true),
    // Phase 3 OTA pricing : detection d'ecarts Clenzy ↔ OTA
    CHANNEX_PRICE_DRIFT_DETECTED(NotificationType.WARNING, NotificationCategory.SYSTEM, true),
    // Domaine 1 : divergence des restrictions de sejour (min stay / CTA / CTD) Clenzy ↔ OTA
    CHANNEX_RESTRICTION_DRIFT_DETECTED(NotificationType.WARNING, NotificationCategory.SYSTEM, true),
    // Phase B Channex — evenements webhook additionnels :
    // UNMAPPED_BOOKING : resa recue sur room/rate NON mappe (priorite doc — risque
    // de double reservation tant que le mapping n'est pas corrige).
    CHANNEX_UNMAPPED_BOOKING(NotificationType.ERROR, NotificationCategory.SYSTEM, true),
    // RATE_ERROR : tarifs rejetes par l'OTA (rate_error webhook).
    CHANNEX_RATE_ERROR(NotificationType.ERROR, NotificationCategory.SYSTEM, true),
    // SYNC_WARNING : avertissement de sync non bloquant remonte par Channex.
    CHANNEX_SYNC_WARNING(NotificationType.WARNING, NotificationCategory.SYSTEM, true),
    // CHANNEL_EVENT : cycle de vie d'un canal OTA (connexion, deconnexion,
    // activation/desactivation) — WARNING car une deconnexion stoppe la distribution.
    CHANNEX_CHANNEL_EVENT(NotificationType.WARNING, NotificationCategory.SYSTEM, true),
    // AIRBNB_REQUEST : demande Airbnb a traiter (reservation_request,
    // alteration_request, inquiry) — action dans l'ecran Channex embarque.
    CHANNEX_AIRBNB_REQUEST(NotificationType.WARNING, NotificationCategory.SYSTEM, true),

    // ─── AI MODEL HEALTH (1 cle) ───────────────────────────────────────────────
    // Emise quand un modele LLM configure repond 410 Gone (EOL chez le provider).
    // Action requise : aller dans Parametres > IA et reassigner un modele vivant
    // a la feature impactee. Dedup en memoire dans AiModelDeprecationListener
    // pour eviter 1000 notifs si 1000 users tapent l'erreur en parallele.
    AI_MODEL_EOL(NotificationType.ERROR, NotificationCategory.SYSTEM, true),

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

    // ─── DOCUMENT (5 cles) ──────────────────────────────────────────────────────

    DOCUMENT_GENERATED(NotificationType.SUCCESS, NotificationCategory.DOCUMENT, true),
    DOCUMENT_GENERATION_FAILED(NotificationType.ERROR, NotificationCategory.DOCUMENT, true),
    DOCUMENT_TEMPLATE_UPLOADED(NotificationType.INFO, NotificationCategory.DOCUMENT, false),
    DOCUMENT_SENT_BY_EMAIL(NotificationType.SUCCESS, NotificationCategory.DOCUMENT, true),
    /** Mandat de gestion signé électroniquement par le propriétaire (lien public). */
    CONTRACT_SIGNED(NotificationType.SUCCESS, NotificationCategory.DOCUMENT, true),

    // ─── RECONCILIATION (3 cles) ──────────────────────────────────────────────

    RECONCILIATION_COMPLETED(NotificationType.INFO, NotificationCategory.SYSTEM, false),
    RECONCILIATION_DIVERGENCE_HIGH(NotificationType.WARNING, NotificationCategory.SYSTEM, true),
    RECONCILIATION_FAILED(NotificationType.ERROR, NotificationCategory.SYSTEM, true),

    // ─── KPI (2 cles) ──────────────────────────────────────────────────────
    KPI_THRESHOLD_BREACH(NotificationType.WARNING, NotificationCategory.SYSTEM, true),
    KPI_CRITICAL_FAILURE(NotificationType.ERROR, NotificationCategory.SYSTEM, true),

    // ─── INCIDENT P1 (2 cles) ──────────────────────────────────────────────
    // Emises par IncidentService a chaque ouverture/resolution d'un incident
    // SERVICE_DOWN. Destinataires : tous les SUPER_ADMIN/SUPER_MANAGER de
    // la plateforme (via notifyAllPlatformStaff).
    INCIDENT_OPENED(NotificationType.ERROR, NotificationCategory.SYSTEM, true),
    INCIDENT_RESOLVED(NotificationType.SUCCESS, NotificationCategory.SYSTEM, true),

    // ─── GUEST MESSAGING (5 cles) ───────────────────────────────────────────
    GUEST_MESSAGE_SENT(NotificationType.INFO, NotificationCategory.GUEST_MESSAGING, true),
    GUEST_MESSAGE_FAILED(NotificationType.ERROR, NotificationCategory.GUEST_MESSAGING, true),
    GUEST_PRICING_PUSHED(NotificationType.INFO, NotificationCategory.GUEST_MESSAGING, false),
    GUEST_NO_EMAIL_FOR_CHECKIN(NotificationType.WARNING, NotificationCategory.GUEST_MESSAGING, true),
    /** Concierge IA (C1) : message guest à traiter en priorité (sentiment négatif / urgent). */
    CONCIERGE_ESCALATION(NotificationType.WARNING, NotificationCategory.GUEST_MESSAGING, true),

    // ─── ACCÈS ──────────────────────────────────────────────────────────────
    ACCESS_CODE_ROTATED(NotificationType.INFO, NotificationCategory.RESERVATION, true),
    GUEST_DOOR_UNLOCKED(NotificationType.INFO, NotificationCategory.RESERVATION, true),

    // ─── NOISE ALERT (4 cles) ──────────────────────────────────────────────
    NOISE_ALERT_WARNING(NotificationType.WARNING, NotificationCategory.NOISE_ALERT, true),
    NOISE_ALERT_CRITICAL(NotificationType.ERROR, NotificationCategory.NOISE_ALERT, true),
    NOISE_ALERT_RESOLVED(NotificationType.SUCCESS, NotificationCategory.NOISE_ALERT, true),
    NOISE_ALERT_CONFIG_CHANGED(NotificationType.INFO, NotificationCategory.NOISE_ALERT, false),

    // ─── CONVERSATION (2 cles) ──────────────────────────────────────────────
    CONVERSATION_NEW_MESSAGE(NotificationType.INFO, NotificationCategory.CONVERSATION, true),
    CONVERSATION_ASSIGNED(NotificationType.INFO, NotificationCategory.CONVERSATION, true),

    // ─── ONLINE CHECK-IN (2 cles) ───────────────────────────────────────────
    ONLINE_CHECKIN_STARTED(NotificationType.INFO, NotificationCategory.GUEST_MESSAGING, true),
    ONLINE_CHECKIN_COMPLETED(NotificationType.SUCCESS, NotificationCategory.GUEST_MESSAGING, true),

    // ─── REVIEW (2 cles) ──────────────────────────────────────────────────
    REVIEW_RECEIVED(NotificationType.INFO, NotificationCategory.REVIEW, true),
    REVIEW_NEGATIVE_ALERT(NotificationType.WARNING, NotificationCategory.REVIEW, true),

    // ─── SUPERVISION / CONSTELLATION (3 cles) ─────────────────────────────
    // Carte HITL actionnable (warning/critical) creee par un agent : l'operateur
    // doit la voir meme hors de l'ecran de supervision (anti « action manquee »).
    SUPERVISION_SUGGESTION(NotificationType.WARNING, NotificationCategory.SYSTEM, true),
    // Action auto-appliquee par la constellation en niveau NOTIFY (Vague 1
    // autonomie) : l'org est prevenue de ce qui vient d'etre fait (montant/objet
    // dans le message) et peut corriger. En FULL (silencieux), seule une entree
    // de feed est produite — pas de notification.
    SUPERVISION_AUTO_APPLIED(NotificationType.INFO, NotificationCategory.SYSTEM, true),
    // Regles de Confiance des cartes (Vague 3) : « vous avez approuve N fois de
    // suite ce type de carte — l'automatiser ? ». Suggestion INERTE : l'humain
    // active (menu Automatisation) ou ignore ; jamais d'activation automatique.
    SUPERVISION_AUTO_RULE_SUGGESTED(NotificationType.INFO, NotificationCategory.SYSTEM, true),

    // ─── PAYOUT (7 cles) ──────────────────────────────────────────────────
    PAYOUT_BATCH_GENERATED(NotificationType.INFO, NotificationCategory.PAYMENT, true),
    PAYOUT_PENDING_APPROVAL(NotificationType.WARNING, NotificationCategory.PAYMENT, true),
    PAYOUT_APPROVED(NotificationType.SUCCESS, NotificationCategory.PAYMENT, true),
    PAYOUT_EXECUTED(NotificationType.SUCCESS, NotificationCategory.PAYMENT, true),
    PAYOUT_FAILED(NotificationType.ERROR, NotificationCategory.PAYMENT, true),
    PAYOUT_CONFIG_SUBMITTED(NotificationType.INFO, NotificationCategory.PAYMENT, true),
    PAYOUT_CONFIG_VERIFIED(NotificationType.SUCCESS, NotificationCategory.PAYMENT, true),

    // ─── RESERVATION (3 cles) ──────────────────────────────────────────────
    RESERVATION_CREATED(NotificationType.INFO, NotificationCategory.RESERVATION, true),
    RESERVATION_UPDATED(NotificationType.INFO, NotificationCategory.RESERVATION, true),
    RESERVATION_CANCELLED(NotificationType.WARNING, NotificationCategory.RESERVATION, true),
    // Demande de réservation (« devis ») soumise depuis le booking engine public (parcours sans paiement).
    BOOKING_INQUIRY_RECEIVED(NotificationType.INFO, NotificationCategory.RESERVATION, true),
    // Checkout booking engine marqué pour revue par le scoring de risque/fraude (P2, enforcement).
    BOOKING_FRAUD_REVIEW(NotificationType.WARNING, NotificationCategory.RESERVATION, true),

    // ─── INTEGRATIONS (webhooks sortants) ─────────────────────────────────
    WEBHOOK_DELIVERY_FAILED(NotificationType.ERROR, NotificationCategory.SYSTEM, true),

    // ─── OPS / MONITORING (1 cle) ──────────────────────────────────────────
    // Emise via POST /api/ops/alerts (OpsAlertController) par le CI/CD (cd-deploy.yml)
    // ou Alertmanager : echec de deploiement, statut deploy KO, pic d'echecs de
    // generation de documents, etc. Destinataires : tout le staff plateforme
    // (notifyAllPlatformStaff). But : ne plus rester aveugle sur un incident infra
    // silencieux (cf. incident CD Deploy casse 2026-06).
    OPS_ALERT(NotificationType.ERROR, NotificationCategory.SYSTEM, true),

    // ─── ASSISTANT (briefings proactifs) ──────────────────────────────────
    BRIEFING_READY(NotificationType.INFO, NotificationCategory.SYSTEM, true),
    VISION_USAGE_THRESHOLD_REACHED(NotificationType.WARNING, NotificationCategory.SYSTEM, true),

    // ─── OBJETS CONNECTES — capteurs d'environnement ────────────────────────────

    IOT_SMOKE_DETECTED(NotificationType.ERROR, NotificationCategory.SYSTEM, true),
    IOT_MOTION_DETECTED(NotificationType.WARNING, NotificationCategory.SYSTEM, true),

    // ─── AUTOMATISATIONS (flux deterministes) ────────────────────────────────
    // Cle generique de l'action NOTIFY_STAFF du moteur AutomationRule pour les
    // declencheurs sans cle metier dediee (ex. LOCK_BATTERY_CRITICAL). Les
    // declencheurs paiement/payout reutilisent PAYMENT_FAILED et
    // PAYOUT_PENDING_APPROVAL.
    AUTOMATION_STAFF_ALERT(NotificationType.WARNING, NotificationCategory.SYSTEM, true);

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
