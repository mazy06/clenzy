package com.clenzy.service.agent.analytics;

import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Attribution canal NETTE de commission (P0-2) — agent {@code fin}.
 *
 * <p>Pour chaque canal (Airbnb / Booking / Vrbo / direct / autre), agrège sur la
 * période le revenu brut, la commission et le revenu NET, avec part % et taux de
 * commission. La commission utilise la valeur RÉELLE par réservation
 * ({@code otaFeeAmount}) quand elle est connue ; sinon un taux par défaut
 * documenté par canal (marqué « estimé »). Read-only, org-scopée.</p>
 *
 * <p>Répond à « quel canal me rapporte vraiment, net de commission » → arbitrage
 * du mix de distribution (pousser le direct, réduire la dépendance OTA).</p>
 */
@Service
public class ChannelAttributionService {

    private final ReservationRepository reservationRepository;
    private final ChannelCommissionResolver commissionResolver;
    private final TenantContext tenantContext;
    private final Clock clock;

    public ChannelAttributionService(ReservationRepository reservationRepository,
                                     ChannelCommissionResolver commissionResolver,
                                     TenantContext tenantContext,
                                     Clock clock) {
        this.reservationRepository = reservationRepository;
        this.commissionResolver = commissionResolver;
        this.tenantContext = tenantContext;
        this.clock = clock;
    }

    /** Attribution par canal pour un logement (gross/commission/net + part + taux). */
    public record ChannelAttribution(
            String channel,
            int reservations,
            BigDecimal grossRevenue,
            BigDecimal commission,
            BigDecimal netRevenue,
            double commissionPct,
            double netSharePct,
            boolean commissionEstimated) {}

    /** Résultat global de l'attribution. */
    public record AttributionResult(
            int months,
            String currency,
            BigDecimal totalGross,
            BigDecimal totalCommission,
            BigDecimal totalNet,
            List<ChannelAttribution> channels,
            String recommendation) {}

    /** Attribution sur les {@code months} derniers mois (borné 1..24). */
    @Transactional(readOnly = true)
    public AttributionResult attribution(int months) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        LocalDate today = LocalDate.now(clock);
        int m = Math.max(1, Math.min(months, 24));
        LocalDate start = today.minusMonths(m);

        Map<String, Acc> byChannel = new LinkedHashMap<>();
        String currency = null;

        for (Reservation r : reservationRepository.findAllByDateRange(start, today, orgId)) {
            if ("cancelled".equalsIgnoreCase(r.getStatus())) {
                continue;
            }
            String channel = commissionResolver.normalize(r.getSource());
            BigDecimal gross = r.getTotalPrice() != null ? r.getTotalPrice() : BigDecimal.ZERO;
            BigDecimal commission = commissionResolver.commissionOf(r, gross);
            boolean estimated = commissionResolver.isEstimated(r);

            Acc acc = byChannel.computeIfAbsent(channel, k -> new Acc());
            acc.count++;
            acc.gross = acc.gross.add(gross);
            acc.commission = acc.commission.add(commission);
            acc.estimated |= estimated;
            if (currency == null && r.getCurrency() != null) {
                currency = r.getCurrency();
            }
        }

        BigDecimal totalGross = BigDecimal.ZERO;
        BigDecimal totalCommission = BigDecimal.ZERO;
        for (Acc a : byChannel.values()) {
            totalGross = totalGross.add(a.gross);
            totalCommission = totalCommission.add(a.commission);
        }
        BigDecimal totalNet = totalGross.subtract(totalCommission);

        List<ChannelAttribution> channels = new ArrayList<>();
        for (Map.Entry<String, Acc> e : byChannel.entrySet()) {
            Acc a = e.getValue();
            BigDecimal net = a.gross.subtract(a.commission);
            channels.add(new ChannelAttribution(
                    e.getKey(), a.count,
                    scale(a.gross), scale(a.commission), scale(net),
                    pct(a.commission, a.gross),
                    pct(net, totalNet),
                    a.estimated));
        }
        channels.sort(Comparator.comparing(ChannelAttribution::netRevenue).reversed());

        return new AttributionResult(m, currency != null ? currency : "EUR",
                scale(totalGross), scale(totalCommission), scale(totalNet),
                channels, recommend(channels, totalCommission));
    }

    private static String recommend(List<ChannelAttribution> channels, BigDecimal totalCommission) {
        if (channels.isEmpty()) {
            return "Aucune réservation sur la période.";
        }
        ChannelAttribution costliest = channels.stream()
                .filter(c -> !"direct".equals(c.channel()))
                .max(Comparator.comparing(ChannelAttribution::commission))
                .orElse(null);
        if (costliest == null || costliest.commission().signum() <= 0) {
            return "Peu ou pas de commission canal sur la période — mix sain.";
        }
        return "Le canal « " + costliest.channel() + " » coûte " + scale(costliest.commission())
                + " de commission (" + Math.round(costliest.commissionPct() * 100)
                + "% du brut). Pousser le direct améliorerait la marge nette.";
    }

    private static double pct(BigDecimal part, BigDecimal whole) {
        if (whole == null || whole.signum() == 0) {
            return 0.0;
        }
        return Math.round(part.doubleValue() / whole.doubleValue() * 10000.0) / 10000.0;
    }

    private static BigDecimal scale(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP);
    }

    /** Accumulateur mutable par canal. */
    private static final class Acc {
        int count;
        BigDecimal gross = BigDecimal.ZERO;
        BigDecimal commission = BigDecimal.ZERO;
        boolean estimated;
    }
}
