package com.clenzy.service;

import com.clenzy.dto.DashboardOverviewSummaryDto;
import com.clenzy.dto.ChannelRevenueDto;
import com.clenzy.model.ChannelSources;
import com.clenzy.dto.DashboardOverviewSummaryDto.InterventionsStatDto;
import com.clenzy.dto.DashboardOverviewSummaryDto.GuestRatingDto;
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
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.GuestReviewRepository;
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
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

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
 * <p>Définitions standard de {@link AccommodationKpis} (comme
 * {@code PropertyPerformanceService} et {@code AiAnalyticsService}) : revenu = CA
 * hébergement seul proratisé aux nuits comprises dans la fenêtre ; nuits disponibles =
 * logements actifs × jours − nuits fermées (BLOCKED / MAINTENANCE) non vendues ;
 * occupation (plafonnée à 100 %) et RevPAN rapportés à ces nuits disponibles.
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
    private final GuestReviewRepository guestReviewRepository;
    private final UserRepository userRepository;
    private final CalendarDayRepository calendarDayRepository;
    private final Clock clock;
    private final CurrencyConverterService currencyConverter;

    public DashboardOverviewSummaryService(PropertyRepository propertyRepository,
                                           ReservationRepository reservationRepository,
                                           InterventionRepository interventionRepository,
                                           ServiceRequestRepository serviceRequestRepository,
                                           GuestReviewRepository guestReviewRepository,
                                           UserRepository userRepository,
                                           CalendarDayRepository calendarDayRepository,
                                           Clock clock,
                                           CurrencyConverterService currencyConverter) {
        this.propertyRepository = propertyRepository;
        this.reservationRepository = reservationRepository;
        this.interventionRepository = interventionRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.guestReviewRepository = guestReviewRepository;
        this.userRepository = userRepository;
        this.calendarDayRepository = calendarDayRepository;
        this.clock = clock;
        this.currencyConverter = currencyConverter;
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
        final KpiTrendDto bookings;
        List<ChannelRevenueDto> channels = List.of();
        long occupiedNights = 0L;
        long availableNights = 0L;
        if (financial && propertiesActive > 0) {
            final List<Reservation> stays = reservationRepository.findOverlappingWindowForDashboard(
                    prevStart, curEndExclusive, orgId, ownerKc).stream()
                    .filter(r -> !AccommodationKpis.isCancelled(r))
                    .toList();
            final ClosedNights closed = ClosedNights.of(calendarDayRepository.findClosedNightsForDashboard(
                    prevStart, curEndExclusive, orgId, ownerKc, PropertyStatus.ACTIVE), stays);
            final long nightsPerWindow = propertiesActive * days;
            final FinancialWindow cur = aggregateWindow(stays, curStart, curEndExclusive,
                    nightsPerWindow - closed.unsoldWithin(curStart, curEndExclusive));
            final FinancialWindow prev = aggregateWindow(stays, prevStart, curStart,
                    nightsPerWindow - closed.unsoldWithin(prevStart, curStart));
            occupancy = new KpiTrendDto(cur.occupancyRate, growthPct(cur.occupancyRate, prev.occupancyRate), prev.occupancyRate);
            revenue = new KpiTrendDto(cur.revenue, growthPct(cur.revenue, prev.revenue), prev.revenue);
            adr = new KpiTrendDto(cur.adr, growthPct(cur.adr, prev.adr), prev.adr);
            revPan = new KpiTrendDto(cur.revPan, growthPct(cur.revPan, prev.revPan), prev.revPan);
            bookings = new KpiTrendDto(cur.bookings, growthPct(cur.bookings, prev.bookings), (double) prev.bookings);
            occupiedNights = cur.occupiedNights;
            availableNights = cur.availableNights;
            channels = channelRevenue(cur, prev);
        } else {
            occupancy = new KpiTrendDto(0, 0);
            revenue = new KpiTrendDto(0, 0);
            adr = new KpiTrendDto(0, 0);
            revPan = new KpiTrendDto(0, 0);
            bookings = new KpiTrendDto(0, 0);
        }

        // ── Avis : moyenne et volume sur la fenêtre, périmètre hôte respecté ──
        final Double avgRating = guestReviewRepository.averagePublicRatingBetween(
                orgId, curStart, curEndExclusive, ownerKc);
        final GuestRatingDto guestRating = new GuestRatingDto(
                avgRating == null ? 0.0 : round1(avgRating),
                guestReviewRepository.countPublicBetween(orgId, curStart, curEndExclusive, ownerKc));

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
                occupancy, revenue, adr, revPan, bookings, guestRating,
                properties,
                new ServiceRequestsStatDto(srPending, srTotal),
                interventionsStat,
                urgentCount,
                pendingPayments,
                new DashboardOverviewSummaryDto.FinancialContextDto(curStart, curEndExclusive,
                        clock.getZone().getId(), "EUR", "ACCOMMODATION_REVENUE", occupiedNights, availableNights),
                channels);
    }

    /**
     * Agrégats financiers d'une fenêtre [start, endExclusive) sur des séjours non annulés —
     * nuits et CA hébergement proratisés, occupation cappée.
     */
    private FinancialWindow aggregateWindow(List<Reservation> stays,
                                                   LocalDate start, LocalDate endExclusive,
                                                   long availableNights) {
        long occupiedNights = 0L;
        long bookings = 0L;
        BigDecimal revenue = BigDecimal.ZERO;
        Map<String, BigDecimal> byChannel = new HashMap<>();
        for (Reservation r : stays) {
            // « Réservations de la période » = celles qui COMMENCENT dans la
            // fenêtre — un séjour à cheval n'est pas compté deux fois.
            if (!r.getCheckIn().isBefore(start) && r.getCheckIn().isBefore(endExclusive)) {
                bookings++;
            }
            occupiedNights += AccommodationKpis.nightsWithin(r, start, endExclusive);
            final String currency = r.getCurrency() == null || r.getCurrency().isBlank()
                    ? "EUR" : r.getCurrency().trim().toUpperCase(Locale.ROOT);
            final BigDecimal amount = AccommodationKpis.proratedAccommodationRevenue(r, start, endExclusive,
                    value -> "EUR".equals(currency) ? value
                            : currencyConverter.convert(value, currency, "EUR", r.getCheckIn()));
            revenue = revenue.add(amount);
            String source = r.getSource();
            if (source == null || source.isBlank() || "other".equalsIgnoreCase(source)) {
                source = ChannelSources.fromName(r.getSourceName());
            }
            byChannel.merge(source.trim().toLowerCase(Locale.ROOT), amount, BigDecimal::add);
        }
        final double occupancyRate = availableNights > 0
                ? Math.min(100.0, occupiedNights * 100.0 / availableNights)
                : 0.0;
        final double adr = occupiedNights > 0
                ? revenue.divide(BigDecimal.valueOf(occupiedNights), 2, RoundingMode.HALF_UP).doubleValue()
                : 0.0;
        final double revPan = availableNights > 0
                ? revenue.divide(BigDecimal.valueOf(availableNights), 2, RoundingMode.HALF_UP).doubleValue()
                : 0.0;
        return new FinancialWindow(round1(occupancyRate),
                revenue.setScale(2, RoundingMode.HALF_UP).doubleValue(), adr, revPan, bookings, byChannel,
                occupiedNights, Math.max(0, availableNights));
    }

    private static List<ChannelRevenueDto> channelRevenue(FinancialWindow current, FinancialWindow previous) {
        Set<String> sources = new HashSet<>(current.byChannel.keySet());
        sources.addAll(previous.byChannel.keySet());
        return sources.stream().map(source -> {
            BigDecimal amount = current.byChannel.getOrDefault(source, BigDecimal.ZERO);
            double before = previous.byChannel.getOrDefault(source, BigDecimal.ZERO).doubleValue();
            return new ChannelRevenueDto(source, source, amount,
                    current.revenue > 0 ? round1(amount.doubleValue() * 100 / current.revenue) : 0,
                    previous.revenue > 0 ? round1(before * 100 / previous.revenue) : null);
        }).filter(channel -> channel.amount().signum() != 0 || (channel.comparePct() != null && channel.comparePct() > 0))
          .sorted(java.util.Comparator.comparing(ChannelRevenueDto::amount).reversed()
                  .thenComparing(ChannelRevenueDto::source))
          .toList();
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

    private record FinancialWindow(double occupancyRate, double revenue, double adr, double revPan,
                                   long bookings, Map<String, BigDecimal> byChannel,
                                   long occupiedNights, long availableNights) {}

    /**
     * Nuits fermées des logements actifs, logement par logement : une date bloquée sort des
     * nuits disponibles sauf si CE logement l'a vendue (une vente sur un autre logement ne
     * rouvre rien).
     */
    private record ClosedNights(Map<Long, Set<LocalDate>> datesByProperty,
                                Map<Long, List<Reservation>> staysByProperty) {

        /** @param rows lignes {@code [Long propertyId, LocalDate date]} de {@code findClosedNightsForDashboard} */
        static ClosedNights of(List<Object[]> rows, List<Reservation> stays) {
            final Map<Long, Set<LocalDate>> dates = new HashMap<>();
            for (Object[] row : rows) {
                dates.computeIfAbsent((Long) row[0], id -> new HashSet<>()).add((LocalDate) row[1]);
            }
            final Map<Long, List<Reservation>> staysByProperty = dates.isEmpty() ? Map.of()
                    : stays.stream().collect(Collectors.groupingBy(r -> r.getProperty().getId()));
            return new ClosedNights(dates, staysByProperty);
        }

        long unsoldWithin(LocalDate from, LocalDate to) {
            long closed = 0L;
            for (Map.Entry<Long, Set<LocalDate>> property : datesByProperty.entrySet()) {
                final Set<LocalDate> sold = AccommodationKpis.soldNights(
                        staysByProperty.getOrDefault(property.getKey(), List.of()), from, to);
                closed += AccommodationKpis.closedUnsoldNights(property.getValue(), sold, from, to);
            }
            return closed;
        }
    }
}
