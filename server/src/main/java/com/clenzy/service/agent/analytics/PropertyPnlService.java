package com.clenzy.service.agent.analytics;

import com.clenzy.model.Intervention;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Rentabilité NETTE par logement (P1-5) — agents {@code fin} + {@code ops}.
 *
 * <p>Par logement et sur la période : revenu (réservations) − commission canal
 * − coûts d'intervention (ménage/maintenance) = profit net + marge %. Classe les
 * logements et signale les déficitaires. Read-only, org-scopée.</p>
 *
 * <p>Commission = valeur réelle ({@code otaFeeAmount}) si connue, sinon taux par
 * défaut par canal (cf. {@link ChannelAttributionService}). Coût d'intervention =
 * coût réel sinon estimé.</p>
 */
@Service
public class PropertyPnlService {

    private final ReservationRepository reservationRepository;
    private final InterventionRepository interventionRepository;
    private final ChannelCommissionResolver commissionResolver;
    private final TenantContext tenantContext;
    private final Clock clock;

    public PropertyPnlService(ReservationRepository reservationRepository,
                              InterventionRepository interventionRepository,
                              ChannelCommissionResolver commissionResolver,
                              TenantContext tenantContext,
                              Clock clock) {
        this.reservationRepository = reservationRepository;
        this.interventionRepository = interventionRepository;
        this.commissionResolver = commissionResolver;
        this.tenantContext = tenantContext;
        this.clock = clock;
    }

    public record PropertyPnl(
            Long propertyId, String propertyName,
            BigDecimal revenue, BigDecimal commission, BigDecimal interventionCost,
            BigDecimal netProfit, double marginPct,
            int reservations, int interventions) {}

    public record PnlResult(
            int months, String currency,
            BigDecimal totalRevenue, BigDecimal totalCommission, BigDecimal totalCost, BigDecimal totalNet,
            List<PropertyPnl> properties, int deficitCount, String recommendation) {}

    @Transactional(readOnly = true)
    public PnlResult compute(int months) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        LocalDate today = LocalDate.now(clock);
        int m = Math.max(1, Math.min(months, 24));
        LocalDate start = today.minusMonths(m);

        Map<Long, Acc> byProperty = new LinkedHashMap<>();
        String currency = null;

        for (Reservation r : reservationRepository.findAllByDateRange(start, today, orgId)) {
            if ("cancelled".equalsIgnoreCase(r.getStatus()) || r.getProperty() == null) {
                continue;
            }
            Acc acc = accFor(byProperty, r.getProperty());
            BigDecimal gross = nz(r.getTotalPrice());
            acc.revenue = acc.revenue.add(gross);
            acc.commission = acc.commission.add(commissionResolver.commissionOf(r, gross));
            acc.reservations++;
            if (currency == null && r.getCurrency() != null) {
                currency = r.getCurrency();
            }
        }

        for (Intervention i : interventionRepository.findAllByDateRange(
                start.atStartOfDay(), today.atTime(LocalTime.MAX), orgId)) {
            if (i.getProperty() == null) {
                continue;
            }
            Acc acc = accFor(byProperty, i.getProperty());
            BigDecimal cost = i.getActualCost() != null ? i.getActualCost() : nz(i.getEstimatedCost());
            acc.interventionCost = acc.interventionCost.add(cost);
            acc.interventions++;
        }

        BigDecimal totalRev = BigDecimal.ZERO, totalComm = BigDecimal.ZERO, totalCost = BigDecimal.ZERO;
        List<PropertyPnl> properties = new ArrayList<>();
        int deficit = 0;
        for (Acc a : byProperty.values()) {
            BigDecimal net = a.revenue.subtract(a.commission).subtract(a.interventionCost);
            if (net.signum() < 0) {
                deficit++;
            }
            totalRev = totalRev.add(a.revenue);
            totalComm = totalComm.add(a.commission);
            totalCost = totalCost.add(a.interventionCost);
            properties.add(new PropertyPnl(a.propertyId, a.propertyName,
                    scale(a.revenue), scale(a.commission), scale(a.interventionCost),
                    scale(net), marginPct(net, a.revenue), a.reservations, a.interventions));
        }
        properties.sort(Comparator.comparing(PropertyPnl::netProfit).reversed());

        BigDecimal totalNet = totalRev.subtract(totalComm).subtract(totalCost);
        return new PnlResult(m, currency != null ? currency : "EUR",
                scale(totalRev), scale(totalComm), scale(totalCost), scale(totalNet),
                properties, deficit, recommend(properties, deficit));
    }

    private static String recommend(List<PropertyPnl> properties, int deficit) {
        if (properties.isEmpty()) {
            return "Aucune donnée sur la période.";
        }
        if (deficit > 0) {
            PropertyPnl worst = properties.get(properties.size() - 1);
            return deficit + " logement(s) en marge négative. Le plus déficitaire : « "
                    + worst.propertyName() + " » (" + worst.netProfit() + "). Revoir prix, coûts ou positionnement.";
        }
        return "Tous les logements sont rentables sur la période.";
    }

    private static Acc accFor(Map<Long, Acc> map, Property p) {
        return map.computeIfAbsent(p.getId(), k -> {
            Acc a = new Acc();
            a.propertyId = p.getId();
            a.propertyName = p.getName();
            return a;
        });
    }

    private static double marginPct(BigDecimal net, BigDecimal revenue) {
        if (revenue == null || revenue.signum() == 0) {
            return 0.0;
        }
        return Math.round(net.doubleValue() / revenue.doubleValue() * 10000.0) / 10000.0;
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private static BigDecimal scale(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP);
    }

    private static final class Acc {
        Long propertyId;
        String propertyName;
        BigDecimal revenue = BigDecimal.ZERO;
        BigDecimal commission = BigDecimal.ZERO;
        BigDecimal interventionCost = BigDecimal.ZERO;
        int reservations;
        int interventions;
    }
}
