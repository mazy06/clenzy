package com.clenzy.service.agent.analytics;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.Property;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Analytique des opérations : coûts, SLA, charge (P1-8) — agent {@code ops}.
 *
 * <p>Sur la période : coût total et par type (ménage/maintenance), coût par
 * logement (top), taux de complétion, taux « à temps » (SLA : terminé au plus tard
 * le jour planifié), interventions en retard, durée moyenne. Read-only, org-scopée.</p>
 */
@Service
public class OpsAnalyticsService {

    private static final int MAX_PROPERTIES = 10;
    private static final int LOOKBACK_EXTRA_DAYS = 0;

    private static final Set<InterventionStatus> ACTIVE = EnumSet.of(
            InterventionStatus.PENDING,
            InterventionStatus.AWAITING_VALIDATION,
            InterventionStatus.IN_PROGRESS);

    private final InterventionRepository interventionRepository;
    private final TenantContext tenantContext;
    private final Clock clock;

    public OpsAnalyticsService(InterventionRepository interventionRepository,
                               TenantContext tenantContext,
                               Clock clock) {
        this.interventionRepository = interventionRepository;
        this.tenantContext = tenantContext;
        this.clock = clock;
    }

    public record PropertyCost(Long propertyId, String propertyName, BigDecimal cost, int interventions) {}

    public record OpsAnalyticsResult(
            int months,
            int totalInterventions,
            BigDecimal totalCost,
            double completionRate,
            double slaOnTimeRate,
            int overdueCount,
            Integer avgDurationMinutes,
            Map<String, BigDecimal> costByType,
            List<PropertyCost> topCostProperties,
            String recommendation) {}

    @Transactional(readOnly = true)
    public OpsAnalyticsResult analyze(int months) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        LocalDateTime now = LocalDateTime.now(clock);
        int m = Math.max(1, Math.min(months, 24));
        LocalDate start = now.toLocalDate().minusMonths(m);

        List<Intervention> interventions = interventionRepository.findAllByDateRange(
                start.atStartOfDay(), now.toLocalDate().atTime(LocalTime.MAX).plusDays(LOOKBACK_EXTRA_DAYS), orgId);

        BigDecimal totalCost = BigDecimal.ZERO;
        Map<String, BigDecimal> costByType = new LinkedHashMap<>();
        costByType.put("CLEANING", BigDecimal.ZERO);
        costByType.put("MAINTENANCE", BigDecimal.ZERO);
        costByType.put("OTHER", BigDecimal.ZERO);
        Map<Long, PropAcc> byProperty = new LinkedHashMap<>();

        int completed = 0, overdue = 0;
        int slaTotal = 0, slaOnTime = 0;
        long durationSum = 0;
        int durationCount = 0;

        for (Intervention i : interventions) {
            BigDecimal cost = i.getActualCost() != null ? i.getActualCost()
                    : (i.getEstimatedCost() != null ? i.getEstimatedCost() : BigDecimal.ZERO);
            totalCost = totalCost.add(cost);
            String cat = categorize(i.getType());
            costByType.merge(cat, cost, BigDecimal::add);

            Property p = i.getProperty();
            if (p != null && p.getId() != null) {
                PropAcc acc = byProperty.computeIfAbsent(p.getId(), k -> {
                    PropAcc a = new PropAcc();
                    a.id = p.getId();
                    a.name = p.getName();
                    return a;
                });
                acc.cost = acc.cost.add(cost);
                acc.count++;
            }

            if (i.getStatus() == InterventionStatus.COMPLETED) {
                completed++;
                if (i.getCompletedAt() != null && i.getScheduledDate() != null) {
                    slaTotal++;
                    if (!i.getCompletedAt().toLocalDate().isAfter(i.getScheduledDate().toLocalDate())) {
                        slaOnTime++;
                    }
                }
            }
            if (i.getScheduledDate() != null && i.getScheduledDate().isBefore(now)
                    && ACTIVE.contains(i.getStatus())) {
                overdue++;
            }
            if (i.getActualDurationMinutes() != null) {
                durationSum += i.getActualDurationMinutes();
                durationCount++;
            }
        }

        int total = interventions.size();
        List<PropertyCost> topCost = byProperty.values().stream()
                .sorted(Comparator.comparing((PropAcc a) -> a.cost).reversed())
                .limit(MAX_PROPERTIES)
                .map(a -> new PropertyCost(a.id, a.name, scale(a.cost), a.count))
                .toList();

        return new OpsAnalyticsResult(
                m, total, scale(totalCost),
                rate(completed, total), rate(slaOnTime, slaTotal), overdue,
                durationCount > 0 ? (int) (durationSum / durationCount) : null,
                scaleMap(costByType), topCost,
                recommend(topCost, overdue, rate(slaOnTime, slaTotal)));
    }

    private static String recommend(List<PropertyCost> topCost, int overdue, double sla) {
        StringBuilder sb = new StringBuilder();
        if (!topCost.isEmpty()) {
            PropertyCost top = topCost.get(0);
            sb.append("Logement le plus coûteux en opérations : « ").append(top.propertyName())
                    .append(" » (").append(top.cost()).append(").");
        }
        if (overdue > 0) {
            sb.append(' ').append(overdue).append(" intervention(s) en retard à traiter.");
        }
        if (sla > 0 && sla < 0.8) {
            sb.append(" SLA « à temps » à ").append(Math.round(sla * 100)).append("% — à améliorer.");
        }
        return sb.length() == 0 ? "Opérations sous contrôle sur la période." : sb.toString();
    }

    private static String categorize(String type) {
        if (type == null) {
            return "OTHER";
        }
        String t = type.toUpperCase();
        if (t.contains("CLEAN") || t.contains("HOUSEKEEP") || t.contains("MENAGE")) {
            return "CLEANING";
        }
        if (t.contains("MAINTEN") || t.contains("REPAIR") || t.contains("PLUMB")
                || t.contains("ELECTR") || t.contains("PLOMB")) {
            return "MAINTENANCE";
        }
        return "OTHER";
    }

    private static double rate(int part, int total) {
        return total > 0 ? Math.round((double) part / total * 10000.0) / 10000.0 : 0.0;
    }

    private static BigDecimal scale(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP);
    }

    private static Map<String, BigDecimal> scaleMap(Map<String, BigDecimal> m) {
        Map<String, BigDecimal> out = new LinkedHashMap<>();
        m.forEach((k, v) -> out.put(k, scale(v)));
        return out;
    }

    private static final class PropAcc {
        Long id;
        String name;
        BigDecimal cost = BigDecimal.ZERO;
        int count;
    }
}
