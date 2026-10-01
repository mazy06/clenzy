package com.clenzy.service;

import com.clenzy.model.Reservation;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import java.util.function.UnaryOperator;

/**
 * Définitions métier standard des KPI d'hébergement (Baitly Académie ép. 01), source unique
 * partagée par {@link AiAnalyticsService}, {@link PropertyPerformanceService} et
 * {@link DashboardOverviewSummaryService} :
 * <ul>
 *   <li>une nuit = [checkIn, checkOut) ; les fenêtres sont semi-ouvertes [from, to) en dates
 *       calendaires du logement ; une réservation annulée ne vend aucune nuit ;</li>
 *   <li>CA hébergement = total encaissé − ménage − taxe de séjour − options, proratisé aux
 *       nuits du séjour comprises dans la fenêtre ;</li>
 *   <li>nuits disponibles = nuits de la fenêtre − nuits fermées (BLOCKED / MAINTENANCE)
 *       non vendues : une nuit vendue malgré un blocage était bien en vente.</li>
 * </ul>
 * D'où : occupation = vendues / disponibles, ADR = CA / vendues, RevPAR = CA / disponibles.
 */
public final class AccommodationKpis {

    private AccommodationKpis() {}

    public static boolean isCancelled(Reservation r) {
        return "cancelled".equalsIgnoreCase(r.getStatus());
    }

    /** Nuits du séjour comprises dans [from, to) ; 0 sans dates. */
    public static long nightsWithin(Reservation r, LocalDate from, LocalDate to) {
        if (r.getCheckIn() == null || r.getCheckOut() == null) return 0L;
        LocalDate start = r.getCheckIn().isBefore(from) ? from : r.getCheckIn();
        LocalDate end = r.getCheckOut().isAfter(to) ? to : r.getCheckOut();
        return Math.max(0L, ChronoUnit.DAYS.between(start, end));
    }

    /** Nuits vendues de [from, to), sans doublon si deux séjours se chevauchent. */
    public static Set<LocalDate> soldNights(Collection<Reservation> reservations, LocalDate from, LocalDate to) {
        Set<LocalDate> sold = new HashSet<>();
        for (Reservation r : reservations) {
            if (r.getCheckIn() == null || r.getCheckOut() == null) continue;
            LocalDate d = r.getCheckIn().isBefore(from) ? from : r.getCheckIn();
            LocalDate end = r.getCheckOut().isAfter(to) ? to : r.getCheckOut();
            while (d.isBefore(end)) {
                sold.add(d);
                d = d.plusDays(1);
            }
        }
        return sold;
    }

    /**
     * Nuits fermées de [from, to) restées invendues : ce qui sort des nuits disponibles.
     *
     * @param closedDates jours BLOCKED / MAINTENANCE du logement
     * @param soldNights  nuits vendues du MÊME logement (fenêtre englobant [from, to))
     */
    public static int closedUnsoldNights(Set<LocalDate> closedDates, Set<LocalDate> soldNights,
                                         LocalDate from, LocalDate to) {
        int closed = 0;
        for (LocalDate d : closedDates) {
            if (!d.isBefore(from) && d.isBefore(to) && !soldNights.contains(d)) closed++;
        }
        return closed;
    }

    /**
     * CA hébergement d'une réservation : total encaissé moins ménage, taxe de séjour et options
     * (montants absents = 0, plancher 0). Booking engine et saisie manuelle ventilent ces montants ;
     * les canaux qui ne le font pas (imports OTA/iCal, widget direct) les laissent à null et leur
     * total est retenu tel quel — un montant OTA peut donc encore inclure le ménage.
     */
    public static BigDecimal accommodationRevenue(Reservation r) {
        BigDecimal accommodation = orZero(r.getTotalPrice())
            .subtract(orZero(r.getCleaningFee()))
            .subtract(orZero(r.getTouristTaxAmount()))
            .subtract(orZero(r.getServiceOptionsTotal()));
        return accommodation.max(BigDecimal.ZERO);
    }

    /** CA hébergement au prorata des nuits du séjour comprises dans [from, to), dans la devise du séjour. */
    public static BigDecimal proratedAccommodationRevenue(Reservation r, LocalDate from, LocalDate to) {
        return proratedAccommodationRevenue(r, from, to, UnaryOperator.identity());
    }

    /**
     * CA hébergement au prorata des nuits comprises dans [from, to) : un séjour à cheval ne porte
     * que ses nuits de la fenêtre. {@code toReportingCurrency} convertit le CA du séjour entier
     * avant proratisation ; il n'est pas appelé pour un séjour sans nuit dans la fenêtre.
     */
    public static BigDecimal proratedAccommodationRevenue(Reservation r, LocalDate from, LocalDate to,
                                                          UnaryOperator<BigDecimal> toReportingCurrency) {
        if (r.getCheckIn() == null || r.getCheckOut() == null) return BigDecimal.ZERO;
        long stayNights = ChronoUnit.DAYS.between(r.getCheckIn(), r.getCheckOut());
        long nightsInWindow = nightsWithin(r, from, to);
        if (stayNights <= 0 || nightsInWindow <= 0) return BigDecimal.ZERO;
        return toReportingCurrency.apply(accommodationRevenue(r))
            .multiply(BigDecimal.valueOf(nightsInWindow))
            .divide(BigDecimal.valueOf(stayNights), 2, RoundingMode.HALF_UP);
    }

    private static BigDecimal orZero(BigDecimal amount) {
        return amount != null ? amount : BigDecimal.ZERO;
    }
}
