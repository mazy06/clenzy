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

        // L'occupation ne se déduit PAS de `curNights` : cette somme porte la durée
        // entière des séjours, y compris leurs nuits hors fenêtre, et compte deux
        // fois celles que deux séjours se disputent. Elle reste juste pour l'ADR
        // (revenu total rapporté aux nuits vendues) et la durée moyenne, pas pour
        // un taux d'occupation.
        final long curOccupied = occupiedNightsAcross(activeProps, reservations, cutoff, days);
        final long prevOccupied = occupiedNightsAcross(activeProps, reservations, prevCutoff, days);

        final long activeInterventions =
                interventionRepository.countByStatus(InterventionStatus.PENDING, orgId)
                        + interventionRepository.countByStatus(InterventionStatus.IN_PROGRESS, orgId);
        final long pendingRequests =
                serviceRequestRepository.countByStatusForDashboard(orgId, null, RequestStatus.PENDING)
                        + serviceRequestRepository.countByStatusForDashboard(orgId, null, RequestStatus.IN_PROGRESS);

        return new GlobalKpis(
                trend(round2(revPan(curRevenue, totalNightsAvailable)), round2(revPan(prevRevenue, totalNightsAvailable))),
                trend(round2(adr(curRevenue, curNights)), round2(adr(prevRevenue, prevNights))),
                trend(round1(occupancyPct(curOccupied, totalNightsAvailable)), round1(occupancyPct(prevOccupied, totalNightsAvailable))),
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

        final List<PropertyOccupancy> byProperty = activeProps.stream().map(p -> {
            final long occupied = occupiedNights(current.stream()
                    .filter(r -> r.getProperty() != null && p.getId().equals(r.getProperty().getId()))
                    .toList(), cutoff, days);
            return new PropertyOccupancy(p.getId(), p.getName(),
                    round1(days > 0 ? (occupied * 100.0) / days : 0.0), occupied, days);
        }).sorted(Comparator.comparingDouble(PropertyOccupancy::rate).reversed()).toList();

        // Le total découle des logements : il ne peut donc pas, lui non plus,
        // dépasser la disponibilité.
        final long totalOccupied = byProperty.stream().mapToLong(PropertyOccupancy::occupiedNights).sum();

        final List<String> months = lastMonths(today, 6);
        final Map<String, Long> occByMonth = new LinkedHashMap<>();
        months.forEach(m -> occByMonth.put(m, 0L));
        // Un séjour appartient aux mois qu'il traverse, pas au mois de son
        // arrivée : autrement, quarante nuits commencées le 28 juin étaient
        // toutes portées par juin.
        final YearMonth firstMonth = YearMonth.from(today).minusMonths(months.size() - 1L);
        for (int i = 0; i < months.size(); i++) {
            final YearMonth ym = firstMonth.plusMonths(i);
            final long occupied = activeProps.stream()
                    .mapToLong(p -> occupiedNights(reservations.stream()
                            .filter(r -> r.getProperty() != null && p.getId().equals(r.getProperty().getId()))
                            .toList(), ym.atDay(1), ym.lengthOfMonth()))
                    .sum();
            occByMonth.put(months.get(i), occupied);
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
            // Des logements occupés, pas des réservations : deux séjours qui se
            // chevauchent sur un même logement ne l'occupent qu'une fois.
            final long dayOccupied = current.stream()
                    .filter(r -> !r.getCheckIn().isAfter(d) && r.getCheckOut().isAfter(d))
                    .filter(r -> r.getProperty() != null)
                    .map(r -> r.getProperty().getId())
                    .distinct()
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

    /**
     * Nuits réellement occupées d'un logement dans la fenêtre {@code [from, from+days)}.
     *
     * <p>On <b>marque</b> les nuits, on ne les additionne pas. Sommer les durées
     * de séjour produisait deux erreurs que l'écran affichait telles quelles :</p>
     * <ul>
     *   <li>un séjour à cheval sur la fenêtre apportait ses nuits d'avant et
     *       d'après, d'où le « 35 nuits sur 30 » et un taux de 117 % ;</li>
     *   <li>deux séjours qui se chevauchent (double-réservation, import iCal en
     *       double) comptaient la même nuit deux fois.</li>
     * </ul>
     *
     * <p>Le résultat est borné par construction : il ne peut pas dépasser
     * {@code days}. Le plafonnement d'affichage côté client devient inutile.</p>
     */
    /** Somme, sur tous les logements actifs, des nuits occupées dans la fenêtre. */
    private static long occupiedNightsAcross(List<Property> activeProps, List<Reservation> reservations,
                                             LocalDate from, int days) {
        return activeProps.stream()
                .mapToLong(p -> occupiedNights(reservations.stream()
                        .filter(r -> r.getProperty() != null && p.getId().equals(r.getProperty().getId()))
                        .toList(), from, days))
                .sum();
    }

    private static long occupiedNights(List<Reservation> reservations, LocalDate from, int days) {
        if (days <= 0) return 0L;
        final boolean[] occupied = new boolean[days];
        for (Reservation r : reservations) {
            if (r.getCheckIn() == null || r.getCheckOut() == null) continue;
            final long start = Math.max(0L, ChronoUnit.DAYS.between(from, r.getCheckIn()));
            // Le départ est exclusif : une nuit du jour J suppose d'y dormir.
            final long end = Math.min(days, ChronoUnit.DAYS.between(from, r.getCheckOut()));
            for (long i = start; i < end; i++) {
                occupied[(int) i] = true;
            }
        }
        long count = 0L;
        for (boolean night : occupied) {
            if (night) count++;
        }
        return count;
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
