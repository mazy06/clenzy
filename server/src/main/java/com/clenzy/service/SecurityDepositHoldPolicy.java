package com.clenzy.service;

import com.clenzy.model.Property;
import com.clenzy.model.Reservation;

import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/**
 * Quand poser, renouveler et considérer échue la pré-autorisation d'une caution — règles de
 * date pures, jugées dans le fuseau du logement (audit #9).
 *
 * <p><b>Pourquoi pas au paiement.</b> Une autorisation carte en ligne ne vit que 4 j 18 h (Visa,
 * transaction initiée par le marchand : notre hold off-session) à 7 j (Mastercard, Amex,
 * Discover), puis Stripe l'annule et libère les fonds. Posée à la réservation, la caution
 * n'existait plus au moment du séjour.</p>
 *
 * <p><b>Pose : le jour de l'arrivée.</b> La garantie doit couvrir le séjour puis la fenêtre de
 * réclamation (départ + {@value #CLAIM_DAYS_AFTER_CHECKOUT} j, libération automatique le
 * lendemain). Posée la veille, cette couverture dépasse 4 j 18 h même pour une nuit : chaque
 * séjour Visa exigerait un renouvellement. Posée le jour J, une nuit tient dans un seul hold, et
 * un refus laisse la matinée à l'hôte pour réagir avant l'arrivée.</p>
 *
 * <p><b>Séjours plus longs : renouvellement.</b> {@link #RENEWAL_MARGIN} avant l'échéance
 * {@code capture_before} lue chez Stripe, un nouveau hold est posé puis l'ancien annulé. Écartés :
 * l'autorisation prolongée (jusqu'à 30 j) est réservée à la tarification IC+ et aux seules
 * transactions initiées par le client — inapplicable à un hold off-session posé à l'arrivée ;
 * la capture différée automatique encaisse les fonds, le contraire d'une caution.</p>
 */
public final class SecurityDepositHoldPolicy {

    /** Jours après le départ pendant lesquels l'hôte peut encore réclamer des dégâts. */
    public static final int CLAIM_DAYS_AFTER_CHECKOUT = 2;

    /** Avance du renouvellement sur l'échéance du hold — laisse à l'hôte le temps de réagir à un refus. */
    public static final Duration RENEWAL_MARGIN = Duration.ofHours(24);

    /** Fenêtre la plus courte (Visa, transaction initiée par le marchand) : repli si Stripe ne dit rien. */
    public static final Duration SHORTEST_VALIDITY = Duration.ofDays(4).plusHours(18);

    /** Repli documenté quand le logement n'a pas de fuseau exploitable (audit #9). */
    static final ZoneId FALLBACK_ZONE = ZoneId.of("Europe/Paris");

    private SecurityDepositHoldPolicy() {}

    /** Le hold se pose du jour de l'arrivée au jour du départ inclus (jamais après le séjour). */
    public static boolean isHoldDue(Reservation reservation, Instant now) {
        final LocalDate today = today(reservation, now);
        return !isCancelled(reservation)
            && !today.isBefore(reservation.getCheckIn())
            && !today.isAfter(reservation.getCheckOut());
    }

    /** Dernier jour où l'hôte peut réclamer des dégâts. */
    public static LocalDate claimWindowEnd(Reservation reservation) {
        return reservation.getCheckOut().plusDays(CLAIM_DAYS_AFTER_CHECKOUT);
    }

    /**
     * Le hold doit-il être remplacé ? Oui s'il échoit avant la fin de la fenêtre de réclamation
     * d'une réservation toujours active.
     */
    public static boolean needsRenewal(Reservation reservation, Instant holdExpiresAt) {
        final LocalDate expiryDay = LocalDate.ofInstant(holdExpiresAt, zoneOf(reservation.getProperty()));
        return !isCancelled(reservation) && !expiryDay.isAfter(claimWindowEnd(reservation));
    }

    /** Plus rien à garantir : réservation annulée ou fenêtre de réclamation close. */
    public static boolean nothingLeftToGuarantee(Reservation reservation, Instant now) {
        return isCancelled(reservation) || today(reservation, now).isAfter(claimWindowEnd(reservation));
    }

    static boolean isCancelled(Reservation reservation) {
        return "cancelled".equalsIgnoreCase(reservation.getStatus());
    }

    static ZoneId zoneOf(Property property) {
        if (property == null || property.getTimezone() == null || property.getTimezone().isBlank()) {
            return FALLBACK_ZONE;
        }
        try {
            return ZoneId.of(property.getTimezone().trim());
        } catch (DateTimeException e) {
            return FALLBACK_ZONE;
        }
    }

    private static LocalDate today(Reservation reservation, Instant now) {
        return LocalDate.ofInstant(now, zoneOf(reservation.getProperty()));
    }
}
