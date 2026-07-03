package com.clenzy.service.automation;

import java.util.Map;

/**
 * Sujet generique d'un declenchement du moteur AutomationRule (fiche 08, vague 2).
 *
 * <p>Contrat SPI partage entre les sources d'evenements (consumers Kafka,
 * schedulers, services capteurs) et le moteur central : le couple
 * {@code subjectType} x {@code subjectId} est la cle de l'idempotence generique
 * {@code AutomationExecution} (regle x subjectType x subjectId). {@code data}
 * porte les donnees utiles aux conditions JSON des regles et aux executeurs
 * (valeurs simples serialisables : String, Number, Boolean).</p>
 */
public record AutomationSubject(String subjectType, Long subjectId, Map<String, Object> data) {

    // ── Types de sujet connus (vague 2) ─────────────────────────────────────
    public static final String TYPE_RESERVATION = "RESERVATION";
    public static final String TYPE_INVOICE = "INVOICE";
    public static final String TYPE_NOISE_ALERT = "NOISE_ALERT";
    /** Capteur IoT (F7b device offline, Minut) — subjectId = id du NoiseDevice. */
    public static final String TYPE_IOT_DEVICE = "IOT_DEVICE";
    /** Propriete (S2 rate parity) — subjectId = id de la Property. */
    public static final String TYPE_PROPERTY = "PROPERTY";

    // ── Cles de donnees standard ────────────────────────────────────────────
    public static final String DATA_PROPERTY_ID = "propertyId";
    /** Dates de sejour au format ISO-8601 (yyyy-MM-dd). */
    public static final String DATA_CHECK_IN = "checkIn";
    public static final String DATA_CHECK_OUT = "checkOut";
    public static final String DATA_RESERVATION_ID = "reservationId";
    /** Nombre de jours ecoules depuis le passage OVERDUE de la facture. */
    public static final String DATA_DAYS_OVERDUE = "daysOverdue";
    public static final String DATA_MEASURED_DB = "measuredDb";
    public static final String DATA_THRESHOLD_DB = "thresholdDb";
    public static final String DATA_SEVERITY = "severity";
    /** Nombre d'alertes bruit sur la propriete dans les dernieres 24 h (escalade). */
    public static final String DATA_ALERTS_LAST_24H = "alertsLast24h";
}
