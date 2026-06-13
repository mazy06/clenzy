package com.clenzy.service;

import com.clenzy.dto.BillingOverviewDto;
import com.clenzy.dto.ChannelRevenueDto;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Calcule les donnees du widget dashboard « Revenus par canal » pour
 * l'organisation courante.
 *
 * <p>Revenu RESERVE (reservations non annulees) regroupe par source, sur le mois
 * ou l'annee en cours (comparaison periode precedente). Tout est derive des
 * donnees DB de l'org (Reservation), org-scope. Les reversements proprietaires
 * sont calcules cote client (carte « Gestion &amp; reversements »).</p>
 *
 * <p>Service strictement read-only, aucun appel HTTP externe.</p>
 */
@Service
@Transactional(readOnly = true)
public class BillingOverviewService {

    private static final String DEFAULT_CURRENCY = "EUR";

    /**
     * Canaux connus regroupes, dans l'ordre d'affichage. Toute source non
     * reconnue est repliee sur "other".
     */
    private static final Map<String, String> CHANNEL_LABELS = new LinkedHashMap<>();
    static {
        CHANNEL_LABELS.put("airbnb", "Airbnb");
        CHANNEL_LABELS.put("booking", "Booking.com");
        CHANNEL_LABELS.put("direct", "Direct");
        CHANNEL_LABELS.put("other", "Autre");
    }

    private final ReservationRepository reservationRepository;

    public BillingOverviewService(ReservationRepository reservationRepository) {
        this.reservationRepository = reservationRepository;
    }

    /**
     * Construit les revenus par canal pour l'org sur la portee choisie
     * (mois ou annee en cours, comparaison periode precedente).
     *
     * @param orgId    organisation courante (jamais null — resolu par le controller)
     * @param currency devise de l'org (repli {@value #DEFAULT_CURRENCY} si null/blank)
     */
    public BillingOverviewDto getBillingOverview(Long orgId, String currency, LocalDate today, String scope) {
        final String resolvedCurrency =
            (currency == null || currency.isBlank()) ? DEFAULT_CURRENCY : currency;

        // Canaux = réservations de la portée choisie (mois ou année en cours),
        // comparaison = même portée sur la période précédente (mois -1 / année -1).
        final LocalDate monthStart = today.withDayOfMonth(1);
        final LocalDate curStart, curEnd, prevStart, prevEnd;
        if ("year".equalsIgnoreCase(scope)) {
            curStart = today.withDayOfYear(1);
            curEnd = today.withDayOfYear(today.lengthOfYear());
            prevStart = curStart.minusYears(1);
            prevEnd = curStart.minusDays(1);
        } else { // month (défaut)
            curStart = monthStart;
            curEnd = today.withDayOfMonth(today.lengthOfMonth());
            prevStart = monthStart.minusMonths(1);
            prevEnd = monthStart.minusDays(1);
        }

        // Canaux = revenu RÉSERVÉ (réservations confirmées, non annulées) — inclut
        // les résas iCal/manuelles sans flag PAID, sinon la carte reste vide.
        List<Reservation> current =
            reservationRepository.findBookedByCheckInRange(curStart, curEnd, orgId);
        List<Reservation> previous =
            reservationRepository.findBookedByCheckInRange(prevStart, prevEnd, orgId);

        List<ChannelRevenueDto> channels = buildChannels(current, previous);

        return new BillingOverviewDto(resolvedCurrency, channels);
    }

    // ── Channels ────────────────────────────────────────────────────────────

    private List<ChannelRevenueDto> buildChannels(List<Reservation> currentMonth,
                                                  List<Reservation> previousMonth) {
        Map<String, BigDecimal> currentBySource = revenueBySource(currentMonth);
        Map<String, BigDecimal> previousBySource = revenueBySource(previousMonth);

        BigDecimal currentTotal = currentBySource.values().stream()
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal previousTotal = previousBySource.values().stream()
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<ChannelRevenueDto> channels = new ArrayList<>();
        for (Map.Entry<String, BigDecimal> entry : currentBySource.entrySet()) {
            String source = entry.getKey();
            BigDecimal amount = scale(entry.getValue());
            double pct = percentage(amount, currentTotal);

            Double comparePct = null;
            BigDecimal prevAmount = previousBySource.get(source);
            // Pas de comparaison si le mois precedent n'a aucun revenu (N/A).
            if (prevAmount != null && previousTotal.compareTo(BigDecimal.ZERO) > 0) {
                comparePct = percentage(prevAmount, previousTotal);
            }

            channels.add(new ChannelRevenueDto(
                source, CHANNEL_LABELS.getOrDefault(source, "Autre"), amount, pct, comparePct));
        }
        return channels;
    }

    /**
     * Revenu encaisse par canal connu (airbnb/booking/direct/other). Toute
     * source inconnue est repliee sur "other". Conserve l'ordre d'affichage.
     */
    private Map<String, BigDecimal> revenueBySource(List<Reservation> reservations) {
        Map<String, BigDecimal> bySource = new LinkedHashMap<>();
        for (Reservation r : reservations) {
            String source = normalizeSource(r.getSource());
            BigDecimal price = r.getTotalPrice() != null ? r.getTotalPrice() : BigDecimal.ZERO;
            bySource.merge(source, price, BigDecimal::add);
        }
        return bySource;
    }

    private String normalizeSource(String rawSource) {
        if (rawSource == null) {
            return "other";
        }
        String key = rawSource.toLowerCase();
        return CHANNEL_LABELS.containsKey(key) ? key : "other";
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    /** Part en % (0-100, 1 decimale), 0.0 si le total est nul. */
    private double percentage(BigDecimal part, BigDecimal total) {
        if (total == null || total.compareTo(BigDecimal.ZERO) <= 0) {
            return 0.0;
        }
        return part.multiply(BigDecimal.valueOf(100))
            .divide(total, 1, RoundingMode.HALF_UP)
            .doubleValue();
    }

    private BigDecimal scale(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }
}
