package com.clenzy.model;

import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Collections;
import java.util.EnumSet;
import java.util.Set;

/**
 * Declencheurs du moteur d'automatisation (registre central des flux deterministes).
 *
 * <p>Deux familles :</p>
 * <ul>
 *   <li><b>Cycle de vie reservation</b> ({@link #RESERVATION_LIFECYCLE}) — amorces a la
 *       creation de la reservation puis re-evalues par le sweep temporel du scheduler
 *       (J-X / jour J / J+X via {@code triggerOffsetDays} + {@code triggerTime}) ;</li>
 *   <li><b>Evenementiels</b> — tires par les capteurs (consumers Kafka, webhooks, crons)
 *       via {@code AutomationEngine.fireTrigger(...)}, execution immediate.</li>
 * </ul>
 *
 * <p><b>Idempotence</b> ({@link #dedupePerSubject}) : pour un declencheur one-shot (le sujet
 * identifie une occurrence unique : reservation, alerte, paiement), le moteur garantit au
 * plus UNE execution par (regle x sujet) — re-livraison Kafka sure. Pour un declencheur
 * RECURRENT sur un sujet stable (relance de facture J+3/J+7, releve mensuel par owner,
 * batterie par device), cette garantie bloquerait toute occurrence suivante : le moteur ne
 * deduplique pas et l'executeur porte SA cle metier (table de dispatch, timestamp de
 * relance, intervention ouverte...).</p>
 */
public enum AutomationTrigger {
    // ── Cycle de vie reservation ─────────────────────────────────────────────
    RESERVATION_CONFIRMED("RESERVATION_CONFIRMED", true),
    CHECK_IN_APPROACHING("CHECK_IN_APPROACHING", true),
    CHECK_IN_DAY("CHECK_IN_DAY", true),
    CHECK_OUT_DAY("CHECK_OUT_DAY", true),
    CHECK_OUT_PASSED("CHECK_OUT_PASSED", true),
    REVIEW_REMINDER("REVIEW_REMINDER", true),

    // ── Evenementiels one-shot (sujet = occurrence unique) ───────────────────
    RESERVATION_BOOKED("RESERVATION_BOOKED", true),
    RESERVATION_CANCELLED("RESERVATION_CANCELLED", true),
    NOISE_ALERT("NOISE_ALERT", true),
    PAYMENT_FAILED("PAYMENT_FAILED", true),

    // ── Evenementiels recurrents (sujet stable, idempotence = cle metier executeur) ──
    LOCK_BATTERY_CRITICAL("LOCK_BATTERY_CRITICAL", false),
    INVOICE_OVERDUE("INVOICE_OVERDUE", false),
    PAYOUT_PENDING_REMINDER("PAYOUT_PENDING_REMINDER", false),
    OWNER_MONTHLY_STATEMENT("OWNER_MONTHLY_STATEMENT", false),
    /**
     * F7b : capteur IoT hors ligne (Minut). Sujet stable (deviceId) → recurrent
     * (dedupePerSubject=false) pour qu'un device revenu online puis re-offline
     * RE-declenche. L'idempotence par EPISODE est portee par le capteur : CAS sur
     * {@code NoiseDevice.online} (transition online→offline = un seul fire, pas de
     * re-fire tant que le device n'est pas repasse online) + filet dedup memoire
     * 24 h de NotifyStaffExecutor.
     */
    IOT_DEVICE_OFFLINE("IOT_DEVICE_OFFLINE", false);

    /**
     * Declencheurs amorces a la creation d'une reservation (et re-evalues par le sweep).
     * Les declencheurs evenementiels n'en font PAS partie : les amorcer a la creation
     * ferait partir (par exemple) une alerte bruit sans aucun bruit.
     */
    public static final Set<AutomationTrigger> RESERVATION_LIFECYCLE =
        Collections.unmodifiableSet(EnumSet.of(
            RESERVATION_CONFIRMED, CHECK_IN_APPROACHING, CHECK_IN_DAY,
            CHECK_OUT_DAY, CHECK_OUT_PASSED, REVIEW_REMINDER));

    private final String value;
    private final boolean dedupePerSubject;

    AutomationTrigger(String value, boolean dedupePerSubject) {
        this.value = value;
        this.dedupePerSubject = dedupePerSubject;
    }

    @JsonValue
    public String getValue() { return value; }

    /** Vrai si le moteur garantit au plus une execution par (regle x sujet). */
    public boolean isDedupePerSubject() { return dedupePerSubject; }
}
