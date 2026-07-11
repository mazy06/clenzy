package com.clenzy.service;

import com.clenzy.dto.DashboardOverviewSummaryDto;
import com.clenzy.dto.DashboardOverviewSummaryDto.InterventionsStatDto;
import com.clenzy.dto.DashboardOverviewSummaryDto.KpiTrendDto;
import com.clenzy.dto.DashboardOverviewSummaryDto.PropertiesStatDto;
import com.clenzy.dto.DashboardOverviewSummaryDto.ServiceRequestsStatDto;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.RequestStatus;
import com.clenzy.model.Reservation;
import com.clenzy.model.UserRole;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Agrégats de l'écran Dashboard « Vue d'ensemble » — remplace l'agrégation
 * côté client de 5 listes {@code size=1000} + toutes les réservations
 * (audit perf navigation 2026-07) par ~10 requêtes SQL bornées.
 *
 * <p>Scoping par rôle (aligné sur les list-endpoints existants) :
 * ADMIN / SUPER_MANAGER → org entière ; HOST → uniquement SES logements
 * (owner.keycloakId) ; rôles opérationnels (technicien, housekeeper, linge,
 * extérieur) → uniquement les interventions qui LEUR sont assignées, KPI
 * financiers non calculés (non affichés pour ces rôles).</p>
 *
 * <p>Formules « corrigées » : revenus proratisés aux nuits comprises dans la
 * fenêtre, occupation plafonnée à 100 % (patron {@code PropertyPerformanceService}).
 * Read-only, aucun appel externe. Dates en zone du {@link Clock} applicatif.</p>
 */
@Service
@Transactional(readOnly = true)
public class DashboardOverviewSummaryService {

    private static final Set<UserRole> OPERATIONAL_ROLES = EnumSet.of(
            UserRole.TECHNICIAN, UserRole.HOUSEKEEPER, UserRole.LAUNDRY, UserRole.EXTERIOR_TECH);

    private static final List<RequestStatus> OPEN_REQUEST_STATUSES = List.of(
            RequestStatus.PENDING, RequestStatus.ASSIGNED,
            RequestStatus.AWAITING_PAYMENT, RequestStatus.IN_PROGRESS);

    private static final List<InterventionStatus> URGENT_OPEN_STATUSES = List.of(
            InterventionStatus.PENDING, InterventionStatus.IN_PROGRESS);

    private final PropertyRepository propertyRepository;
    private final ReservationRepository reservationRepository;
    private final InterventionRepository interventionRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final UserRepository userRepository;
    private final Clock clock;

    public DashboardOverviewSummaryService(PropertyRepository propertyRepository,
                                           ReservationRepository reservationRepository,
                                           InterventionRepository interventionRepository,
                                           ServiceRequestRepository serviceRequestRepository,
                                           UserRepository userRepository,
                                           Clock clock) {
        this.propertyRepository = propertyRepository;
        this.reservationRepository = reservationRepository;
        this.interventionRepository = interventionRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.userRepository = userRepository;
        this.clock = clock;
    }

    public DashboardOverviewSummaryDto getSummary(Long orgId, int days, UserRole role, String keycloakId) {
        final LocalDate today = LocalDate.now(clock);

        // Scopes optionnels selon le rôle (null = pas de restriction).
        final String ownerKc = role == UserRole.HOST ? keycloakId : null;
        final Long assigneeId = OPERATIONAL_ROLES.contains(role)
                ? userRepository.findByKeycloakId(keycloakId).map(u -> u.getId()).orElse(-1L)
                : null;

        // Fenêtres : courante = [today-days+1 .. today], précédente = même durée juste avant.
        final LocalDate curStart = today.minusDays(days - 1L);
        final LocalDate curEndExclusive = today.plusDays(1);
        final LocalDate prevStart = curStart.minusDays(days);

        // ── Propriétés ──────────────────────────────────────────────────────
        final long propertiesTotal = propertyRepository.countForDashboard(orgId, ownerKc);
        final long propertiesActive = propertyRepository.countForDashboardByStatus(orgId, ownerKc, PropertyStatus.ACTIVE);
        final long activeBefore = propertyRepository.countForDashboardByStatusCreatedBefore(
                orgId, ownerKc, PropertyStatus.ACTIVE, curStart.atStartOfDay());
        final PropertiesStatDto properties = new PropertiesStatDto(
                propertiesActive, propertiesTotal, growthPct(propertiesActive, activeBefore));

        // ── KPI financiers (non calculés pour les rôles opérationnels : non affichés) ──
        final boolean financial = assigneeId == null;
        final KpiTrendDto occupancy;
        final KpiTrendDto revenue;
        final KpiTrendDto adr;
        final KpiTrendDto revPan;
        if (financial && propertiesActive > 0) {
            final List<Reservation> span = reservationRepository.findOverlappingWindowForDashboard(
                    prevStart, curEndExclusive, orgId, ownerKc);
            final FinancialWindow cur = aggregateWindow(span, curStart, curEndExclusive, propertiesActive, days);
            final FinancialWindow prev = aggregateWindow(span, prevStart, curStart, propertiesActive, days);
            occupancy = new KpiTrendDto(cur.occupancyRate, growthPct(cur.occupancyRate, prev.occupancyRate));
            revenue = new KpiTrendDto(cur.revenue, growthPct(cur.revenue, prev.revenue));
            adr = new KpiTrendDto(cur.adr, growthPct(cur.adr, prev.adr));
            revPan = new KpiTrendDto(cur.revPan, growthPct(cur.revPan, prev.revPan));
        } else {
            occupancy = new KpiTrendDto(0, 0);
            revenue = new KpiTrendDto(0, 0);
            adr = new KpiTrendDto(0, 0);
            revPan = new KpiTrendDto(0, 0);
        }

        // ── Interventions : fenêtre étendue [prevStart .. today+8) pour couvrir
        //    la période précédente (growth) ET les 7 prochains jours (upcoming) ──
        final List<Intervention> interventions = interventionRepository.findForDashboardWindow(
                prevStart.atStartOfDay(), today.plusDays(8).atStartOfDay(), orgId, ownerKc, assigneeId);
        final InterventionsStatDto interventionsStat =
                aggregateInterventions(interventions, curStart, today, days);

        // ── Demandes de service (fenêtre de la période) ─────────────────────
        final long srTotal = serviceRequestRepository.countWindowForDashboard(
                curStart.atStartOfDay(), curEndExclusive.atStartOfDay(), orgId, ownerKc);
        final long srPending = serviceRequestRepository.countWindowByStatusesForDashboard(
                curStart.atStartOfDay(), curEndExclusive.atStartOfDay(), orgId, ownerKc, OPEN_REQUEST_STATUSES);

        // ── Compteurs d'action (non bornés à la fenêtre) ────────────────────
        final long urgentCount = interventionRepository.countUrgentForDashboard(
                orgId, ownerKc, assigneeId, URGENT_OPEN_STATUSES);
        final long pendingPayments = assigneeId != null ? 0L
                : interventionRepository.countPendingPaymentsForDashboard(orgId, ownerKc, PaymentStatus.PENDING)
                + serviceRequestRepository.countByStatusForDashboard(orgId, ownerKc, RequestStatus.AWAITING_PAYMENT)
                + reservationRepository.countDirectPendingPaymentsForDashboard(orgId, ownerKc, PaymentStatus.PENDING);

        return new DashboardOverviewSummaryDto(
                occupancy, revenue, adr, revPan,
                properties,
                new ServiceRequestsStatDto(srPending, srTotal),
                interventionsStat,
                urgentCount,
                pendingPayments);
    }

    /** Agrégats financiers d'une fenêtre [start, endExclusive) — nuits/revenus proratisés, occupation cappée. */
    private static FinancialWindow aggregateWindow(List<Reservation> reservations,
                                                   LocalDate start, LocalDate endExclusive,
                                                   long activeProperties, int days) {
        long occupiedNights = 0L;
        BigDecimal revenue = BigDecimal.ZERO;
        for (Reservation r : reservations) {
            if ("cancelled".equalsIgnoreCase(r.getStatus())) {
                continue;
            }
            final LocalDate s = r.getCheckIn().isBefore(start) ? start : r.getCheckIn();
            final LocalDate e = r.getCheckOut().isBefore(endExclusive) ? r.getCheckOut() : endExclusive;
            final long nights = Math.max(0L, ChronoUnit.DAYS.between(s, e));
            if (nights == 0L) {
                continue;
            }
            final long totalNights = Math.max(1L, ChronoUnit.DAYS.between(r.getCheckIn(), r.getCheckOut()));
            occupiedNights += nights;
            final BigDecimal price = r.getTotalPrice() != null ? r.getTotalPrice() : BigDecimal.ZERO;
            revenue = revenue.add(price
                    .multiply(BigDecimal.valueOf(nights))
                    .divide(BigDecimal.valueOf(totalNights), 2, RoundingMode.HALF_UP));
        }
        final long availableNights = activeProperties * days;
        final double occupancyRate = availableNights > 0
                ? Math.min(100.0, occupiedNights * 100.0 / availableNights)
                : 0.0;
        final double adr = occupiedNights > 0
                ? revenue.divide(BigDecimal.valueOf(occupiedNights), 2, RoundingMode.HALF_UP).doubleValue()
                : 0.0;
        final double revPan = availableNights > 0
                ? revenue.divide(BigDecimal.valueOf(availableNights), 2, RoundingMode.HALF_UP).doubleValue()
                : 0.0;
        return new FinancialWindow(round1(occupancyRate), revenue.setScale(2, RoundingMode.HALF_UP).doubleValue(), adr, revPan);
    }

    private InterventionsStatDto aggregateInterventions(List<Intervention> interventions,
                                                        LocalDate curStart, LocalDate today, int days) {
        final LocalDate prevStart = curStart.minusDays(days);
        final LocalDate upcomingEndExclusive = today.plusDays(8);
        long total = 0;
        long previousTotal = 0;
        long todayCount = 0;
        long upcoming = 0;
        long completed = 0;
        BigDecimal totalRevenue = BigDecimal.ZERO;

        for (Intervention i : interventions) {
            if (i.getScheduledDate() == null) {
                continue;
            }
            final LocalDate d = i.getScheduledDate().toLocalDate();
            final boolean isCompleted = i.getStatus() == InterventionStatus.COMPLETED;

            if (!d.isBefore(prevStart) && d.isBefore(curStart)) {
                previousTotal++;
            }
            if (!d.isBefore(curStart) && !d.isAfter(today)) {
                total++;
                if (isCompleted) {
                    completed++;
                    final BigDecimal cost = i.getActualCost() != null ? i.getActualCost()
                            : (i.getEstimatedCost() != null ? i.getEstimatedCost() : BigDecimal.ZERO);
                    totalRevenue = totalRevenue.add(cost);
                }
            }
            if (d.isEqual(today)) {
                todayCount++;
            }
            if (d.isAfter(today) && d.isBefore(upcomingEndExclusive)
                    && !isCompleted && i.getStatus() != InterventionStatus.CANCELLED) {
                upcoming++;
            }
        }

        final double completionRate = total > 0 ? round1(completed * 100.0 / total) : 0.0;
        return new InterventionsStatDto(todayCount, total, growthPct(total, previousTotal), upcoming,
                completed, completionRate, totalRevenue.setScale(2, RoundingMode.HALF_UP));
    }

    /** Variation en % vs la valeur précédente (convention : précédent nul → 100 si courant > 0). */
    private static double growthPct(double current, double previous) {
        if (previous == 0.0) {
            return current > 0.0 ? 100.0 : 0.0;
        }
        return round1((current - previous) * 100.0 / previous);
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private record FinancialWindow(double occupancyRate, double revenue, double adr, double revPan) {}
}
