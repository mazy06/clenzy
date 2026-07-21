package com.clenzy.service;

import com.clenzy.dto.ReportChartItemDto;
import com.clenzy.dto.ReportFinancialStatsDto;
import com.clenzy.dto.ReportFinancialStatsDto.MonthlyFinancialDto;
import com.clenzy.dto.ReportInterventionStatsDto;
import com.clenzy.dto.ReportInterventionStatsDto.MonthlyCountDto;
import com.clenzy.dto.ReportPropertyStatsDto;
import com.clenzy.dto.ReportPropertyStatsDto.PropertyStatDto;
import com.clenzy.dto.ReportTeamStatsDto;
import com.clenzy.dto.ReportTeamStatsDto.TeamPerformanceDto;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Agrégats de l'écran Rapports Baitly (onglets Interventions / Logements /
 * Équipes / Finances) — remplace l'agrégation côté client de listes
 * {@code size=1000} (résultats silencieusement tronqués au-delà de 1000
 * interventions, audit perf 2026-07-21) par des requêtes {@code GROUP BY}
 * bornées (patron {@link DashboardOverviewSummaryService}).
 *
 * <p>Scoping par rôle, aligné sur les list-endpoints remplacés :
 * ADMIN / SUPER_MANAGER → org entière ; HOST → uniquement SES logements
 * (owner.keycloakId) ; rôles opérationnels → uniquement les interventions
 * qui LEUR sont assignées.</p>
 *
 * <p>Read-only, aucun appel externe. Mois au format ISO {@code yyyy-MM}
 * (libellés localisés côté client), fenêtre mensuelle = 6 derniers mois en
 * zone du {@link Clock} applicatif.</p>
 */
@Service
@Transactional(readOnly = true)
public class ReportStatsService {

    private static final Set<UserRole> OPERATIONAL_ROLES = EnumSet.of(
            UserRole.TECHNICIAN, UserRole.HOUSEKEEPER, UserRole.LAUNDRY, UserRole.EXTERIOR_TECH);

    private static final int MONTHS_WINDOW = 6;
    private static final int TOP_PROPERTIES = 10;

    /**
     * Estimation grossière des revenus = dépenses × 1,3 — héritée de l'ancien
     * calcul client, à remplacer par la facturation réelle quand branchée.
     */
    private static final BigDecimal REVENUE_MARKUP = new BigDecimal("1.3");

    private final InterventionRepository interventionRepository;
    private final PropertyRepository propertyRepository;
    private final TeamRepository teamRepository;
    private final UserRepository userRepository;
    private final Clock clock;

    public ReportStatsService(InterventionRepository interventionRepository,
                              PropertyRepository propertyRepository,
                              TeamRepository teamRepository,
                              UserRepository userRepository,
                              Clock clock) {
        this.interventionRepository = interventionRepository;
        this.propertyRepository = propertyRepository;
        this.teamRepository = teamRepository;
        this.userRepository = userRepository;
        this.clock = clock;
    }

    public ReportInterventionStatsDto getInterventionStats(Long orgId, UserRole role, String keycloakId) {
        final Scope scope = resolveScope(role, keycloakId);

        final List<ReportChartItemDto> byStatus = interventionRepository
                .countByStatusForReport(orgId, scope.ownerKc(), scope.assigneeId()).stream()
                .map(row -> new ReportChartItemDto(statusName(row[0]), (Long) row[1]))
                .toList();

        final List<ReportChartItemDto> byType = interventionRepository
                .countAndCostByTypeForReport(orgId, scope.ownerKc(), scope.assigneeId()).stream()
                .map(row -> new ReportChartItemDto(row[0] != null ? (String) row[0] : "", (Long) row[1]))
                .toList();

        final List<ReportChartItemDto> byPriority = interventionRepository
                .countByPriorityForReport(orgId, scope.ownerKc(), scope.assigneeId()).stream()
                .map(row -> new ReportChartItemDto(row[0] != null ? (String) row[0] : "MEDIUM", (Long) row[1]))
                .toList();

        final List<MonthlyCountDto> byMonth = buildMonthlyCounts(
                fetchMonthlyRows(orgId, scope));

        return new ReportInterventionStatsDto(byStatus, byType, byMonth, byPriority);
    }

    public ReportPropertyStatsDto getPropertyStats(Long orgId, UserRole role, String keycloakId) {
        final Scope scope = resolveScope(role, keycloakId);
        final List<PropertyStatDto> stats = propertyRepository
                .topByInterventionCountForReport(orgId, scope.ownerKc(), PageRequest.of(0, TOP_PROPERTIES))
                .stream()
                .map(row -> new PropertyStatDto((String) row[0], (Long) row[1], roundToLong((BigDecimal) row[2])))
                .toList();
        return new ReportPropertyStatsDto(stats);
    }

    public ReportTeamStatsDto getTeamStats(Long orgId, UserRole role, String keycloakId) {
        final Scope scope = resolveScope(role, keycloakId);

        // Compteurs par équipe/statut en une requête, puis fusion avec la liste
        // des équipes (les équipes sans intervention apparaissent à zéro).
        final Map<Long, long[]> countsByTeam = new HashMap<>();
        for (Object[] row : interventionRepository.countByTeamAndStatusForReport(orgId, scope.ownerKc())) {
            final Long teamId = (Long) row[0];
            final InterventionStatus status = (InterventionStatus) row[1];
            final long count = (Long) row[2];
            final long[] counters = countsByTeam.computeIfAbsent(teamId, id -> new long[3]);
            switch (status) {
                case COMPLETED -> counters[0] += count;
                case IN_PROGRESS -> counters[1] += count;
                case PENDING -> counters[2] += count;
                default -> { /* autres statuts non affichés sur ce graphique */ }
            }
        }

        final List<TeamPerformanceDto> performance = teamRepository.findIdAndNameForReport(orgId).stream()
                .map(row -> {
                    final long[] counters = countsByTeam.getOrDefault((Long) row[0], new long[3]);
                    return new TeamPerformanceDto((String) row[1], counters[0], counters[1], counters[2]);
                })
                .toList();
        return new ReportTeamStatsDto(performance);
    }

    public ReportFinancialStatsDto getFinancialStats(Long orgId, UserRole role, String keycloakId) {
        final Scope scope = resolveScope(role, keycloakId);

        final List<MonthlyFinancialDto> monthlyFinancials =
                buildMonthlyFinancials(fetchMonthlyRows(orgId, scope));

        final List<ReportChartItemDto> costBreakdown = interventionRepository
                .countAndCostByTypeForReport(orgId, scope.ownerKc(), scope.assigneeId()).stream()
                .map(row -> new ReportChartItemDto(
                        row[0] != null ? (String) row[0] : "", roundToLong((BigDecimal) row[2])))
                .toList();

        return new ReportFinancialStatsDto(monthlyFinancials, costBreakdown);
    }

    // ── Fenêtre mensuelle partagée (Interventions + Finances) ───────────────

    private List<Object[]> fetchMonthlyRows(Long orgId, Scope scope) {
        final YearMonth current = YearMonth.now(clock);
        final LocalDateTime from = current.minusMonths(MONTHS_WINDOW - 1L).atDay(1).atStartOfDay();
        final LocalDateTime toExclusive = current.plusMonths(1).atDay(1).atStartOfDay();
        return interventionRepository.monthlyCountsAndCostsForReport(
                from, toExclusive, orgId, scope.ownerKc(), scope.assigneeId());
    }

    private List<MonthlyCountDto> buildMonthlyCounts(List<Object[]> rows) {
        final Map<YearMonth, long[]> byMonth = new HashMap<>();
        for (Object[] row : rows) {
            final long[] counters = byMonth.computeIfAbsent(rowMonth(row), m -> new long[3]);
            final InterventionStatus status = (InterventionStatus) row[2];
            final long count = (Long) row[3];
            counters[0] += count;
            if (status == InterventionStatus.COMPLETED) {
                counters[1] += count;
            }
            if (status == InterventionStatus.PENDING) {
                counters[2] += count;
            }
        }
        final List<MonthlyCountDto> result = new ArrayList<>(MONTHS_WINDOW);
        for (YearMonth month : windowMonths()) {
            final long[] counters = byMonth.getOrDefault(month, new long[3]);
            result.add(new MonthlyCountDto(month.toString(), counters[0], counters[1], counters[2]));
        }
        return result;
    }

    private List<MonthlyFinancialDto> buildMonthlyFinancials(List<Object[]> rows) {
        final Map<YearMonth, BigDecimal> costByMonth = new HashMap<>();
        for (Object[] row : rows) {
            costByMonth.merge(rowMonth(row), (BigDecimal) row[4], BigDecimal::add);
        }
        final List<MonthlyFinancialDto> result = new ArrayList<>(MONTHS_WINDOW);
        for (YearMonth month : windowMonths()) {
            final BigDecimal cost = costByMonth.getOrDefault(month, BigDecimal.ZERO);
            final long expenses = roundToLong(cost);
            final long revenue = roundToLong(cost.multiply(REVENUE_MARKUP));
            result.add(new MonthlyFinancialDto(month.toString(), revenue, expenses, revenue - expenses));
        }
        return result;
    }

    private List<YearMonth> windowMonths() {
        final YearMonth current = YearMonth.now(clock);
        final List<YearMonth> months = new ArrayList<>(MONTHS_WINDOW);
        for (int i = MONTHS_WINDOW - 1; i >= 0; i--) {
            months.add(current.minusMonths(i));
        }
        return months;
    }

    private static YearMonth rowMonth(Object[] row) {
        return YearMonth.of(((Number) row[0]).intValue(), ((Number) row[1]).intValue());
    }

    // ── Scoping par rôle (patron DashboardOverviewSummaryService) ───────────

    private Scope resolveScope(UserRole role, String keycloakId) {
        final String ownerKc = role == UserRole.HOST ? keycloakId : null;
        final Long assigneeId = OPERATIONAL_ROLES.contains(role)
                ? userRepository.findByKeycloakId(keycloakId).map(User::getId).orElse(-1L)
                : null;
        return new Scope(ownerKc, assigneeId);
    }

    private static String statusName(Object status) {
        return status != null ? ((InterventionStatus) status).name() : "UNKNOWN";
    }

    private static long roundToLong(BigDecimal value) {
        return value == null ? 0L : value.setScale(0, RoundingMode.HALF_UP).longValueExact();
    }

    private record Scope(String ownerKc, Long assigneeId) {}
}
