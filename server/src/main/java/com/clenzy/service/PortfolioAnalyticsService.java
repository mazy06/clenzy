package com.clenzy.service;

import com.clenzy.dto.analytics.PortfolioAnalyticsDto;
import com.clenzy.dto.analytics.PortfolioAnalyticsDto.ChannelRevenue;
import com.clenzy.dto.analytics.PortfolioAnalyticsDto.DayOccupancy;
import com.clenzy.dto.analytics.PortfolioAnalyticsDto.GlobalKpis;
import com.clenzy.dto.analytics.PortfolioAnalyticsDto.MonthlyOccupancy;
import com.clenzy.dto.analytics.PortfolioAnalyticsDto.MonthlyRevenue;
import com.clenzy.dto.analytics.PortfolioAnalyticsDto.OccupancyMetrics;
import com.clenzy.dto.analytics.PortfolioAnalyticsDto.PropertyOccupancy;
import com.clenzy.dto.analytics.PortfolioAnalyticsDto.PropertyRevenue;
import com.clenzy.dto.analytics.PortfolioAnalyticsDto.RevenueMetrics;
import com.clenzy.dto.analytics.PortfolioAnalyticsDto.TrendValue;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.RequestStatus;
import com.clenzy.model.Reservation;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Analytics agrégées d'un portefeuille (org) calculées côté serveur — rapatriement
 * des slices {@code global} / {@code revenue} / {@code occupancy} du hook client
 * {@code useAnalyticsEngine}. Reproduit fidèlement {@code computeGlobalKPIs} /
 * {@code computeRevenueMetrics} / {@code computeOccupancyMetrics}, avec une
 * correction majeure : les <b>coûts d'intervention réels</b> alimentent la marge et
 * le ROI (le client passait {@code interventions=[]} → marge/ROI faussés), et les
 * données ne sont jamais tronquées par la pagination front.
 *
 * <p>Fenêtre glissante {@code days} ; comparaison période N-1 = fenêtre glissante
 * précédente (PAS year-over-year), à l'identique du client.</p>
 */
@Service
@Transactional(readOnly = true)
public class PortfolioAnalyticsService {

    /** Libellé de mois « janv. 26 » — même format que le {@code getMonthLabel} client. */
    private static final DateTimeFormatter MONTH_LABEL = DateTimeFormatter.ofPattern("MMM yy", Locale.FRENCH);
    private static final Map<String, String> CHANNEL_COLORS = Map.of(
            "airbnb", "#FF5A5F", "booking", "#003580", "direct", "#4A9B8E", "other", "#94A3B8");
    private static final String DEFAULT_CHANNEL_COLOR = "#94A3B8";
    private static final int HEATMAP_DAYS = 42;
    private static final int MONTH_DAYS = 30;

    private final ReservationRepository reservationRepository;
    private final PropertyRepository propertyRepository;
    private final InterventionRepository interventionRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final Clock clock;

    public PortfolioAnalyticsService(ReservationRepository reservationRepository,
                                     PropertyRepository propertyRepository,
                                     InterventionRepository interventionRepository,
                                     ServiceRequestRepository serviceRequestRepository,
                                     Clock clock) {
        this.reservationRepository = reservationRepository;
        this.propertyRepository = propertyRepository;
        this.interventionRepository = interventionRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.clock = clock;
    }

    public PortfolioAnalyticsDto getPortfolio(Long orgId, int days) {
        final LocalDate today = LocalDate.now(clock);
        final LocalDate cutoff = today.minusDays(days);
        final LocalDate prevCutoff = today.minusDays(2L * days);
        // Fenêtre de chargement couvrant tous les calculs (période N-1, 6 mois, heatmap).
        final LocalDate sixMonthsStart = YearMonth.from(today).minusMonths(5).atDay(1);
        final LocalDate wideFrom = min(prevCutoff, min(sixMonthsStart, today.minusDays(HEATMAP_DAYS)));

        final List<Property> activeProps = propertyRepository
                .findByOrganizationIdAndStatus(orgId, PropertyStatus.ACTIVE);
        final List<Reservation> reservations = reservationRepository
                .findAllByDateRange(wideFrom, today, orgId).stream()
                .filter(r -> !"cancelled".equalsIgnoreCase(r.getStatus()))
                .toList();
        final List<Intervention> interventions = interventionRepository
                .findAllByDateRange(prevCutoff.atStartOfDay(), today.plusDays(1).atStartOfDay(), orgId);

        return new PortfolioAnalyticsDto(
                computeGlobal(orgId, activeProps, reservations, interventions, today, cutoff, prevCutoff, days),
                computeRevenue(reservations, today, cutoff, prevCutoff, days),
                computeOccupancy(activeProps, reservations, today, cutoff, days));
    }

    // ── global ───────────────────────────────────────────────────────────────

    private GlobalKpis computeGlobal(Long orgId, List<Property> activeProps,
                                     List<Reservation> reservations, List<Intervention> interventions,
                                     LocalDate today, LocalDate cutoff, LocalDate prevCutoff, int days) {
        final long activeCount = Math.max(1, activeProps.size());
        final long totalNightsAvailable = activeCount * days;

        double curRevenue = 0, prevRevenue = 0, curNights = 0, prevNights = 0, curCosts = 0, prevCosts = 0;
        int curBookings = 0, prevBookings = 0;
        for (Reservation r : reservations) {
            final boolean cur = !r.getCheckOut().isBefore(cutoff) && !r.getCheckIn().isAfter(today);
            final boolean prev = !r.getCheckOut().isBefore(prevCutoff) && r.getCheckOut().isBefore(cutoff);
            final double price = price(r);
            final long nights = nights(r);
            if (cur) {
                curRevenue += price;
                curNights += nights;
                curBookings++;
            }
            if (prev) {
                prevRevenue += price;
                prevNights += nights;
                prevBookings++;
            }
        }
        for (Intervention i : interventions) {
            final LocalDate d = interventionDate(i);
            if (d == null) {
                continue;
            }
            final double cost = cost(i);
            if (!d.isBefore(cutoff) && !d.isAfter(today)) {
                curCosts += cost;
            } else if (!d.isBefore(prevCutoff) && d.isBefore(cutoff)) {
                prevCosts += cost;
            }
        }

        final long activeInterventions =
                interventionRepository.countByStatus(InterventionStatus.PENDING, orgId)
                        + interventionRepository.countByStatus(InterventionStatus.IN_PROGRESS, orgId);
        final long pendingRequests =
                serviceRequestRepository.countByStatusForDashboard(orgId, null, RequestStatus.PENDING)
                        + serviceRequestRepository.countByStatusForDashboard(orgId, null, RequestStatus.IN_PROGRESS);

        return new GlobalKpis(
                trend(round2(revPan(curRevenue, totalNightsAvailable)), round2(revPan(prevRevenue, totalNightsAvailable))),
                trend(round2(adr(curRevenue, curNights)), round2(adr(prevRevenue, prevNights))),
                trend(round1(occupancyPct(curNights, totalNightsAvailable)), round1(occupancyPct(prevNights, totalNightsAvailable))),
                trend(Math.round(curRevenue), Math.round(prevRevenue)),
                trend(round1(marginPct(curRevenue, curCosts)), round1(marginPct(prevRevenue, prevCosts))),
                trend(round1(roiPct(curRevenue, curCosts)), round1(roiPct(prevRevenue, prevCosts))),
                trend(round1(avg(curNights, curBookings)), round1(avg(prevNights, prevBookings))),
                activeProps.size(), pendingRequests, activeInterventions);
    }

    // ── revenue ──────────────────────────────────────────────────────────────

    private RevenueMetrics computeRevenue(List<Reservation> reservations,
                                          LocalDate today, LocalDate cutoff, LocalDate prevCutoff, int days) {
        final List<String> months = lastMonths(today, 6);
        final Map<String, Double> revByMonth = new LinkedHashMap<>();
        months.forEach(m -> revByMonth.put(m, 0.0));
        for (Reservation r : reservations) {
            final String label = MONTH_LABEL.format(r.getCheckIn());
            if (revByMonth.containsKey(label)) {
                revByMonth.merge(label, price(r), Double::sum);
            }
        }
        final List<MonthlyRevenue> byMonth = months.stream().map(m -> {
            final long revenue = Math.round(revByMonth.get(m));
            final long expenses = Math.round(revenue * 0.25); // ~25 % de coûts opérationnels (parité front)
            return new MonthlyRevenue(m, revenue, expenses, revenue - expenses);
        }).toList();

        double curRev = 0, prevRev = 0;
        int curBookings = 0;
        final Map<String, Double> byChannel = new LinkedHashMap<>();
        final Map<Long, double[]> byPropertyAgg = new LinkedHashMap<>();
        final Map<Long, String> propertyNames = new LinkedHashMap<>();
        for (Reservation r : reservations) {
            final boolean cur = !r.getCheckOut().isBefore(cutoff);
            final boolean prev = !r.getCheckOut().isBefore(prevCutoff) && r.getCheckOut().isBefore(cutoff);
            final double price = price(r);
            if (cur) {
                curRev += price;
                curBookings++;
                final String source = r.getSource() != null ? r.getSource() : "other";
                byChannel.merge(source, price, Double::sum);
                final Long pid = r.getProperty() != null ? r.getProperty().getId() : null;
                if (pid != null) {
                    byPropertyAgg.computeIfAbsent(pid, k -> new double[1])[0] += price;
                    propertyNames.putIfAbsent(pid, propertyName(r));
                }
            }
            if (prev) {
                prevRev += price;
            }
        }

        final List<ChannelRevenue> channels = byChannel.entrySet().stream()
                .map(e -> new ChannelRevenue(capitalize(e.getKey()), Math.round(e.getValue()),
                        CHANNEL_COLORS.getOrDefault(e.getKey(), DEFAULT_CHANNEL_COLOR)))
                .toList();
        final List<PropertyRevenue> topProperties = byPropertyAgg.entrySet().stream()
                .map(e -> new PropertyRevenue(e.getKey(), propertyNames.get(e.getKey()), Math.round(e.getValue()[0])))
                .sorted(Comparator.comparingLong(PropertyRevenue::revenue).reversed())
                .limit(5)
                .toList();

        return new RevenueMetrics(byMonth, channels, topProperties,
                growth(Math.round(curRev), Math.round(prevRev)),
                curBookings > 0 ? Math.round(curRev / curBookings) : 0L);
    }

    // ── occupancy ────────────────────────────────────────────────────────────

    private OccupancyMetrics computeOccupancy(List<Property> activeProps, List<Reservation> reservations,
                                              LocalDate today, LocalDate cutoff, int days) {
        final long totalNightsAvailable = (long) activeProps.size() * days;
        final List<Reservation> current = reservations.stream()
                .filter(r -> !r.getCheckOut().isBefore(cutoff) && !r.getCheckIn().isAfter(today))
                .toList();
        final long totalOccupied = current.stream().mapToLong(PortfolioAnalyticsService::nights).sum();

        final List<PropertyOccupancy> byProperty = activeProps.stream().map(p -> {
            final long occupied = current.stream()
                    .filter(r -> r.getProperty() != null && p.getId().equals(r.getProperty().getId()))
                    .mapToLong(PortfolioAnalyticsService::nights).sum();
            return new PropertyOccupancy(p.getId(), p.getName(),
                    round1(days > 0 ? (occupied * 100.0) / days : 0.0), occupied, days);
        }).sorted(Comparator.comparingDouble(PropertyOccupancy::rate).reversed()).toList();

        final List<String> months = lastMonths(today, 6);
        final Map<String, Long> occByMonth = new LinkedHashMap<>();
        months.forEach(m -> occByMonth.put(m, 0L));
        for (Reservation r : reservations) {
            final String label = MONTH_LABEL.format(r.getCheckIn());
            if (occByMonth.containsKey(label)) {
                occByMonth.merge(label, nights(r), Long::sum);
            }
        }
        final long monthAvailable = (long) activeProps.size() * MONTH_DAYS;
        final List<MonthlyOccupancy> byMonth = months.stream().map(m -> {
            final long occupied = occByMonth.get(m);
            final long vacant = Math.max(0, monthAvailable - occupied);
            final double rate = monthAvailable > 0 ? Math.round((occupied * 1000.0) / monthAvailable) / 10.0 : 0.0;
            return new MonthlyOccupancy(m, Math.min(occupied, monthAvailable), vacant, rate);
        }).toList();

        final long gapNights = Math.max(0, totalNightsAvailable - totalOccupied);

        final List<DayOccupancy> heatmap = new ArrayList<>(HEATMAP_DAYS);
        for (int i = HEATMAP_DAYS - 1; i >= 0; i--) {
            final LocalDate d = today.minusDays(i);
            final long dayOccupied = current.stream()
                    .filter(r -> !r.getCheckIn().isAfter(d) && r.getCheckOut().isAfter(d))
                    .count();
            heatmap.add(new DayOccupancy(d.toString(),
                    activeProps.isEmpty() ? 0.0 : (double) dayOccupied / activeProps.size()));
        }

        return new OccupancyMetrics(round1(occupancyPct(totalOccupied, totalNightsAvailable)),
                byProperty, byMonth, gapNights, heatmap);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static long nights(Reservation r) {
        return Math.max(0L, ChronoUnit.DAYS.between(r.getCheckIn(), r.getCheckOut()));
    }

    private static double price(Reservation r) {
        return r.getTotalPrice() != null ? r.getTotalPrice().doubleValue() : 0.0;
    }

    private static double cost(Intervention i) {
        if (i.getActualCost() != null) {
            return i.getActualCost().doubleValue();
        }
        return i.getEstimatedCost() != null ? i.getEstimatedCost().doubleValue() : 0.0;
    }

    private static LocalDate interventionDate(Intervention i) {
        if (i.getScheduledDate() != null) {
            return i.getScheduledDate().toLocalDate();
        }
        return i.getCreatedAt() != null ? i.getCreatedAt().toLocalDate() : null;
    }

    private static String propertyName(Reservation r) {
        if (r.getProperty() != null && r.getProperty().getName() != null) {
            return r.getProperty().getName();
        }
        return "Logement #" + (r.getProperty() != null ? r.getProperty().getId() : "?");
    }

    private static double revPan(double revenue, long available) {
        return available > 0 ? revenue / available : 0.0;
    }

    private static double adr(double revenue, double nights) {
        return nights > 0 ? revenue / nights : 0.0;
    }

    private static double occupancyPct(double nights, long available) {
        return available > 0 ? (nights / available) * 100.0 : 0.0;
    }

    private static double marginPct(double revenue, double costs) {
        return revenue > 0 ? ((revenue - costs) / revenue) * 100.0 : 0.0;
    }

    private static double roiPct(double revenue, double costs) {
        return costs > 0 ? ((revenue - costs) / costs) * 100.0 : 0.0;
    }

    private static double avg(double total, int count) {
        return count > 0 ? total / count : 0.0;
    }

    private static TrendValue trend(double current, double previous) {
        return new TrendValue(current, previous, growth(current, previous));
    }

    /** Croissance en % (arrondi entier), 100 si base nulle et valeur positive — parité {@code calcGrowth}. */
    private static int growth(double current, double previous) {
        if (previous == 0) {
            return current > 0 ? 100 : 0;
        }
        return (int) Math.round(((current - previous) / previous) * 100.0);
    }

    private static List<String> lastMonths(LocalDate today, int count) {
        final List<String> months = new ArrayList<>(count);
        final YearMonth base = YearMonth.from(today);
        for (int i = count - 1; i >= 0; i--) {
            months.add(MONTH_LABEL.format(base.minusMonths(i).atDay(1)));
        }
        return months;
    }

    private static String capitalize(String s) {
        if (s == null || s.isEmpty()) {
            return s;
        }
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private static LocalDate min(LocalDate a, LocalDate b) {
        return a.isBefore(b) ? a : b;
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
