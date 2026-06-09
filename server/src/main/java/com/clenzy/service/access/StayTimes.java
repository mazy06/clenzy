package com.clenzy.service.access;

import com.clenzy.model.Property;
import com.clenzy.model.Reservation;

import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/**
 * Moments clés d'un séjour dans le fuseau horaire du logement : arrivée
 * (date + heure de check-in) et départ (date + heure de check-out).
 *
 * <p>Heure de la réservation prioritaire, sinon défaut du logement, sinon
 * repli 15:00 / 11:00. Fuseau : {@code property.timezone}, repli système.
 * Utilisé par le gating du code d'accès (livret), la rotation après départ
 * et le déverrouillage guest.</p>
 */
public final class StayTimes {

    private static final LocalTime DEFAULT_CHECK_IN = LocalTime.of(15, 0);
    private static final LocalTime DEFAULT_CHECK_OUT = LocalTime.of(11, 0);

    private StayTimes() {}

    /** Moment d'arrivée (check-in date + heure) dans le fuseau du logement ; null sans date. */
    public static ZonedDateTime checkInMoment(Reservation reservation, Property property) {
        if (reservation == null || reservation.getCheckIn() == null) return null;
        String time = firstNonBlank(reservation.getCheckInTime(),
                property != null ? property.getDefaultCheckInTime() : null);
        return reservation.getCheckIn().atTime(parseTime(time, DEFAULT_CHECK_IN)).atZone(zoneOf(property));
    }

    /** Moment de départ (check-out date + heure) dans le fuseau du logement ; null sans date. */
    public static ZonedDateTime checkOutMoment(Reservation reservation, Property property) {
        if (reservation == null || reservation.getCheckOut() == null) return null;
        String time = firstNonBlank(reservation.getCheckOutTime(),
                property != null ? property.getDefaultCheckOutTime() : null);
        return reservation.getCheckOut().atTime(parseTime(time, DEFAULT_CHECK_OUT)).atZone(zoneOf(property));
    }

    /**
     * Vrai si le séjour est « en cours côté accès » : l'heure de check-in est passée.
     * Sans date de réservation, aucune restriction (rien sur quoi se baser).
     */
    public static boolean isAfterCheckIn(Reservation reservation, Property property) {
        ZonedDateTime checkIn = checkInMoment(reservation, property);
        return checkIn == null || !ZonedDateTime.now(zoneOf(property)).isBefore(checkIn);
    }

    /**
     * Vrai si on est STRICTEMENT dans la fenêtre du séjour : heure de check-in passée
     * ET heure de check-out pas encore atteinte. Bornes absentes = non bloquantes.
     */
    public static boolean isDuringStay(Reservation reservation, Property property) {
        if (!isAfterCheckIn(reservation, property)) return false;
        ZonedDateTime checkOut = checkOutMoment(reservation, property);
        return checkOut == null || !ZonedDateTime.now(zoneOf(property)).isAfter(checkOut);
    }

    /** Fuseau horaire du logement ; repli sur le fuseau système si absent/invalide. */
    public static ZoneId zoneOf(Property property) {
        if (property != null && property.getTimezone() != null && !property.getTimezone().isBlank()) {
            try {
                return ZoneId.of(property.getTimezone().trim());
            } catch (Exception ignored) {
                // repli ci-dessous
            }
        }
        return ZoneId.systemDefault();
    }

    /** Parse "HH:mm" (ou "HH:mm:ss") ; repli {@code fallback} si absent/illisible. */
    public static LocalTime parseTime(String value, LocalTime fallback) {
        if (value != null && !value.isBlank()) {
            try {
                return LocalTime.parse(value.trim());
            } catch (Exception ignored) {
                // repli ci-dessous
            }
        }
        return fallback;
    }

    private static String firstNonBlank(String a, String b) {
        return (a != null && !a.isBlank()) ? a : b;
    }
}
