package com.clenzy.model;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Actions du moteur d'automatisation. Chaque action est executee par un bean
 * {@code AutomationActionExecutor} (service/automation) decouvert par injection —
 * une action sans executeur enregistre produit un statut FAILED explicite,
 * jamais un no-op silencieux.
 */
public enum AutomationAction {
    // ── Messaging guest (executeurs fournis par le moteur) ───────────────────
    SEND_MESSAGE("SEND_MESSAGE"),
    SEND_CHECKIN_LINK("SEND_CHECKIN_LINK"),
    SEND_GUIDE("SEND_GUIDE"),
    SEND_REVIEW_REQUEST("SEND_REVIEW_REQUEST"),

    // ── Flux deterministes Vague 1-2 (executeurs fournis par leurs modules) ──
    CREATE_CLEANING_REQUEST("CREATE_CLEANING_REQUEST"),
    CANCEL_LINKED_CLEANING_REQUEST("CANCEL_LINKED_CLEANING_REQUEST"),
    CREATE_MAINTENANCE_INTERVENTION("CREATE_MAINTENANCE_INTERVENTION"),
    SEND_INVOICE_REMINDER("SEND_INVOICE_REMINDER"),
    NOTIFY_STAFF("NOTIFY_STAFF"),
    SEND_OWNER_STATEMENT("SEND_OWNER_STATEMENT"),
    SEND_NOISE_WARNING("SEND_NOISE_WARNING"),

    // ── Flux Vague 3 — arbitrage utilisateur (fiche 08) ──────────────────────
    // Les flux « argent » ne s'executent JAMAIS seuls : les actions SUGGEST_*
    // creent une suggestion actionnable HITL (SupervisionSuggestionService) que
    // l'operateur applique ou rejette. Seule la revocation de code est auto
    // (delai de grace apres le check-out).
    /** F2b : annulation → suggestion de remboursement de la caution (HITL). */
    SUGGEST_DEPOSIT_REFUND("SUGGEST_DEPOSIT_REFUND"),
    /** F4c : check-out + J+X → suggestion de liberation de la caution (HITL). */
    SUGGEST_DEPOSIT_RELEASE("SUGGEST_DEPOSIT_RELEASE"),
    /** F6c : escalade bruit → suggestion de blocage du calendrier (HITL). */
    SUGGEST_CALENDAR_BLOCK("SUGGEST_CALENDAR_BLOCK"),
    /** F4b : revocation auto du code d'acces apres check-out + grace (pas de suggestion). */
    REVOKE_ACCESS_CODE("REVOKE_ACCESS_CODE");

    private final String value;
    AutomationAction(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }
}
