package com.clenzy.service;

import com.clenzy.dto.BillingOverviewDto;
import com.clenzy.dto.ChannelRevenueDto;
import com.clenzy.model.ChannelSources;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Calcule les donnees du widget dashboard « Revenus par canal » pour
 * l'organisation courante.
 *
 * <p>Revenu RESERVE (reservations non annulees) regroupe par canal, sur le mois
 * ou l'annee en cours (comparaison periode precedente). Tout est derive des
 * donnees DB de l'org (Reservation), org-scope. Les reversements proprietaires
 * sont calcules cote client (carte « Gestion &amp; reversements »).</p>
 *
 * <p>Le catalogue de canaux est renvoye <b>en entier a chaque appel</b>, canaux
 * sans revenu compris, et <b>classe par revenu decroissant</b> : la carte se lit
 * comme un classement, et sa hauteur ne varie plus d'une periode a l'autre.</p>
 *
 * <p>Service strictement read-only, aucun appel HTTP externe.</p>
 */
@Service
@Transactional(readOnly = true)
public class BillingOverviewService {

    private static final String DEFAULT_CURRENCY = "EUR";

    /**
     * Catalogue des canaux, dans l'ordre de depart (ex aequo et canaux a zero).
     * Toutes ces lignes sont renvoyees a chaque appel, meme sans revenu : une
     * carte dont les lignes apparaissent et disparaissent d'un mois a l'autre
     * n'est pas comparable, et un canal a zero est une information en soi.
     */
    private static final Map<String, String> CHANNEL_LABELS = new LinkedHashMap<>();
    static {
        CHANNEL_LABELS.put("airbnb", "Airbnb");
        CHANNEL_LABELS.put("booking", "Booking.com");
        CHANNEL_LABELS.put("vrbo", "Vrbo");
        CHANNEL_LABELS.put("expedia", "Expedia");
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
        Map<String, BigDecimal> currentByChannel = revenueByChannel(currentMonth);
        Map<String, BigDecimal> previousByChannel = revenueByChannel(previousMonth);

        BigDecimal currentTotal = currentByChannel.values().stream()
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal previousTotal = previousByChannel.values().stream()
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<ChannelRevenueDto> channels = new ArrayList<>();
        for (Map.Entry<String, String> catalogEntry : CHANNEL_LABELS.entrySet()) {
            String channel = catalogEntry.getKey();
            BigDecimal amount = scale(currentByChannel.getOrDefault(channel, BigDecimal.ZERO));
            double pct = percentage(amount, currentTotal);

            // Pas de comparaison si la periode precedente n'a aucun revenu (N/A).
            // Sinon, un canal absent de cette periode y pesait bien 0 % : le dire
            // explicitement fait apparaitre la chute (▼ x pt) au lieu de la masquer.
            Double comparePct = previousTotal.compareTo(BigDecimal.ZERO) > 0
                ? percentage(previousByChannel.getOrDefault(channel, BigDecimal.ZERO), previousTotal)
                : null;

            channels.add(new ChannelRevenueDto(
                channel, catalogEntry.getValue(), amount, pct, comparePct));
        }

        // Classement par revenu decroissant. `List.sort` est stable : les ex aequo
        // — au premier rang desquels les canaux a zero — gardent l'ordre du catalogue.
        channels.sort(Comparator.comparing(ChannelRevenueDto::amount).reversed());
        return channels;
    }

    /**
     * Revenu agrege par canal du catalogue. Les canaux sans reservation sont
     * simplement absents de la map — c'est {@link #buildChannels} qui garantit
     * la ligne a zero.
     */
    private Map<String, BigDecimal> revenueByChannel(List<Reservation> reservations) {
        Map<String, BigDecimal> byChannel = new LinkedHashMap<>();
        for (Reservation r : reservations) {
            BigDecimal price = r.getTotalPrice() != null ? r.getTotalPrice() : BigDecimal.ZERO;
            byChannel.merge(resolveChannel(r), price, BigDecimal::add);
        }
        return byChannel;
    }

    /**
     * Canal d'affichage d'une reservation.
     *
     * <p>La source technique d'abord : depuis que le vocabulaire est ouvert, elle
     * distingue elle-meme Vrbo d'Expedia. Le nom de source ne sert plus qu'aux
     * lignes ANCIENNES, ecrites quand tout ce qui n'etait ni Airbnb ni Booking
     * etait replie sur « other » — sans ce repli, leur chiffre d'affaires
     * resterait dans « Autre » a jamais.</p>
     */
    private String resolveChannel(Reservation reservation) {
        String key = normalizeSource(reservation.getSource());
        if (!"other".equals(key)) {
            return key;
        }
        return normalizeSource(ChannelSources.fromName(reservation.getSourceName()));
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
