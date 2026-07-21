package com.clenzy.service.report;

import com.clenzy.dto.ReportResultDto;
import com.clenzy.dto.ReportResultRowDto;
import com.clenzy.model.Intervention;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.Reservation;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.agent.analytics.ChannelCommissionResolver;
import com.clenzy.service.report.ReportFieldCatalog.Dimension;
import com.clenzy.service.report.ReportFieldCatalog.Granularity;
import com.clenzy.service.report.ReportFieldCatalog.Metric;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.time.temporal.IsoFields;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Moteur d'exécution du Report Builder (fondations RMS R1) — la brique « à
 * venir » annoncée par {@link ReportFieldCatalog}.
 *
 * <p><b>Anti-injection</b> : la définition est validée par le catalog AVANT tout
 * calcul ; aucun code utilisateur n'est jamais traduit en requête — l'agrégation
 * est faite en mémoire sur un fetch org-scopé (pattern
 * {@code DashboardOverviewSummaryService} / {@code PropertyPnlService}).</p>
 *
 * <p><b>Attribution par nuit</b> : chaque nuit d'un séjour porte 1/N du prix et de
 * la commission vers son bucket (dimension PERIOD = la nuit, pas le check-in) —
 * les séjours à cheval sur deux périodes sont proratisés exactement, comme le
 * dashboard overview. Formules alignées sur l'existant : commission =
 * {@link ChannelCommissionResolver#commissionOf}, coût d'intervention = réel
 * sinon estimé, MARGIN = REVENUE − FEES − coûts.</p>
 *
 * <p>Limitations assumées (V1) : montants sommés sans conversion de devise (même
 * limitation que le P&amp;L par bien) ; {@code filtersJson} des vues sauvegardées
 * pas encore appliqué ; OCCUPANCY/REVPAR d'un canal = part des nuits disponibles
 * du périmètre vendue via ce canal (la capacité n'est pas par canal — les parts
 * somment à l'occupation totale).</p>
 */
@Service
public class ReportExecutionService {

    /** Période maximale : 2 ans (le fetch et l'agrégation restent bornés). */
    static final int MAX_PERIOD_DAYS = 731;
    /** Valeur de dimension pour un coût sans nuit vendue correspondante. */
    static final String NO_CHANNEL = "—";

    private final ReservationRepository reservationRepository;
    private final InterventionRepository interventionRepository;
    private final PropertyRepository propertyRepository;
    private final ChannelCommissionResolver commissionResolver;
    private final ReportFieldCatalog catalog;

    public ReportExecutionService(ReservationRepository reservationRepository,
                                  InterventionRepository interventionRepository,
                                  PropertyRepository propertyRepository,
                                  ChannelCommissionResolver commissionResolver,
                                  ReportFieldCatalog catalog) {
        this.reservationRepository = reservationRepository;
        this.interventionRepository = interventionRepository;
        this.propertyRepository = propertyRepository;
        this.commissionResolver = commissionResolver;
        this.catalog = catalog;
    }

    @Transactional(readOnly = true)
    public ReportResultDto execute(List<String> dimensionCodes, List<String> metricCodes,
                                   String granularityCode, LocalDate from, LocalDate to, Long orgId) {
        catalog.validate(dimensionCodes, metricCodes, granularityCode);
        if (from == null || to == null || !from.isBefore(to.plusDays(1))) {
            throw new IllegalArgumentException("Période invalide : from doit être <= to");
        }
        final LocalDate toExclusive = to.plusDays(1);
        if (ChronoUnit.DAYS.between(from, toExclusive) > MAX_PERIOD_DAYS) {
            throw new IllegalArgumentException("Période trop longue (max " + MAX_PERIOD_DAYS + " jours)");
        }
        final List<Dimension> dimensions = dimensionCodes.stream()
                .map(c -> Dimension.valueOf(c.trim().toUpperCase(Locale.ROOT))).distinct().toList();
        final Set<Metric> metrics = EnumSet.copyOf(metricCodes.stream()
                .map(c -> Metric.valueOf(c.trim().toUpperCase(Locale.ROOT))).toList());
        final Granularity granularity = granularityCode == null || granularityCode.isBlank()
                ? Granularity.MONTH
                : Granularity.valueOf(granularityCode.trim().toUpperCase(Locale.ROOT));

        final List<Property> properties = propertyRepository.findByOrganizationId(orgId);
        final Map<Long, Property> propertyById = new HashMap<>();
        properties.forEach(p -> propertyById.put(p.getId(), p));

        // ── Agrégation par nuit ─────────────────────────────────────────────
        final Map<List<String>, Group> groups = new LinkedHashMap<>();
        String currency = null;
        for (Reservation r : reservationRepository.findOverlappingWindowForPace(
                from, toExclusive, orgId, null, null)) {
            if ("cancelled".equalsIgnoreCase(r.getStatus())) {
                continue;
            }
            final Property property = propertyById.get(r.getProperty().getId());
            if (property == null) {
                continue;
            }
            if (currency == null && r.getCurrency() != null) {
                currency = r.getCurrency();
            }
            final long totalNights = Math.max(1L, ChronoUnit.DAYS.between(r.getCheckIn(), r.getCheckOut()));
            final BigDecimal gross = nz(r.getTotalPrice());
            // Précision : per-nuit en 4 décimales, arrondi 2 décimales à la sortie
            // seulement (évite la dérive de centimes sur les longs séjours).
            final BigDecimal revenuePerNight = divide4(gross, totalNights);
            final BigDecimal feePerNight = divide4(commissionResolver.commissionOf(r, gross), totalNights);
            final LocalDate first = r.getCheckIn().isBefore(from) ? from : r.getCheckIn();
            final LocalDate lastExclusive = r.getCheckOut().isBefore(toExclusive) ? r.getCheckOut() : toExclusive;
            for (LocalDate night = first; night.isBefore(lastExclusive); night = night.plusDays(1)) {
                final Group group = groupFor(groups, dimensions, granularity,
                        property, channelOf(r), night, from, toExclusive);
                group.nights++;
                group.revenue = group.revenue.add(revenuePerNight);
                group.fees = group.fees.add(feePerNight);
            }
        }

        // ── Coûts d'intervention (MARGIN) ───────────────────────────────────
        if (metrics.contains(Metric.MARGIN)) {
            attributeInterventionCosts(groups, dimensions, granularity, propertyById,
                    from, toExclusive, orgId);
        }

        // ── Lignes de résultat ──────────────────────────────────────────────
        final long activeTotal = properties.stream()
                .filter(p -> p.getStatus() == PropertyStatus.ACTIVE).count();
        final Map<String, Long> activeByCountry = new HashMap<>();
        properties.stream().filter(p -> p.getStatus() == PropertyStatus.ACTIVE)
                .forEach(p -> activeByCountry.merge(countryOf(p), 1L, Long::sum));

        final List<ReportResultRowDto> rows = new ArrayList<>(groups.size());
        for (Map.Entry<List<String>, Group> entry : groups.entrySet()) {
            rows.add(new ReportResultRowDto(entry.getKey(),
                    metricsOf(entry.getValue(), metrics, dimensions, entry.getKey(),
                            activeTotal, activeByCountry, from, toExclusive)));
        }
        rows.sort(Comparator.comparing(row -> String.join("|", row.dimensionValues())));
        return new ReportResultDto(
                dimensions.stream().map(Enum::name).toList(),
                metrics.stream().map(Enum::name).toList(),
                granularity.name(), from, to,
                currency != null ? currency : "EUR", rows);
    }

    // ── Groupes ─────────────────────────────────────────────────────────────

    private static final class Group {
        long nights;
        BigDecimal revenue = BigDecimal.ZERO;
        BigDecimal fees = BigDecimal.ZERO;
        BigDecimal costs = BigDecimal.ZERO;
        LocalDate bucketStart;
        LocalDate bucketEndExclusive;
    }

    private static Group groupFor(Map<List<String>, Group> groups, List<Dimension> dimensions,
                                  Granularity granularity, Property property, String channel,
                                  LocalDate night, LocalDate from, LocalDate toExclusive) {
        final List<String> key = new ArrayList<>(dimensions.size());
        LocalDate bucketStart = from;
        LocalDate bucketEnd = toExclusive;
        for (Dimension dimension : dimensions) {
            switch (dimension) {
                case PROPERTY -> key.add(propertyLabel(property));
                case CHANNEL -> key.add(channel);
                case COUNTRY -> key.add(countryOf(property));
                case PERIOD -> {
                    bucketStart = bucketStart(night, granularity);
                    bucketEnd = bucketEndExclusive(night, granularity);
                    key.add(bucketLabel(night, granularity));
                }
            }
        }
        final Group group = groups.computeIfAbsent(key, k -> new Group());
        if (group.bucketStart == null) {
            group.bucketStart = max(bucketStart, from);
            group.bucketEndExclusive = min(bucketEnd, toExclusive);
        }
        return group;
    }

    /**
     * Coûts d'intervention attribués au bucket (propriété, période, pays) de leur
     * date planifiée. Si CHANNEL est demandé, le coût est réparti pro-rata des
     * nuits entre les canaux du même bucket (la capacité/le coût ne sont pas par
     * canal) — à défaut de nuit vendue, ligne dédiée canal {@value #NO_CHANNEL}.
     */
    private void attributeInterventionCosts(Map<List<String>, Group> groups,
                                            List<Dimension> dimensions, Granularity granularity,
                                            Map<Long, Property> propertyById,
                                            LocalDate from, LocalDate toExclusive, Long orgId) {
        for (Intervention intervention : interventionRepository.findAllByDateRange(
                from.atStartOfDay(), toExclusive.minusDays(1).atTime(LocalTime.MAX), orgId)) {
            if (intervention.getProperty() == null || intervention.getScheduledDate() == null) {
                continue;
            }
            final Property property = propertyById.get(intervention.getProperty().getId());
            if (property == null) {
                continue;
            }
            final BigDecimal cost = intervention.getActualCost() != null
                    ? intervention.getActualCost() : nz(intervention.getEstimatedCost());
            if (cost.signum() == 0) {
                continue;
            }
            final LocalDate day = intervention.getScheduledDate().toLocalDate();
            final List<Group> matching = new ArrayList<>();
            for (Map.Entry<List<String>, Group> entry : groups.entrySet()) {
                if (matchesIgnoringChannel(entry.getKey(), dimensions, granularity, property, day)) {
                    matching.add(entry.getValue());
                }
            }
            if (matching.isEmpty()) {
                final Group orphan = groupFor(groups, dimensions, granularity,
                        property, NO_CHANNEL, day, from, toExclusive);
                orphan.costs = orphan.costs.add(cost);
                continue;
            }
            // Répartition pro-rata des nuits entre les groupes du même bucket
            // (sans dimension CHANNEL, matching contient un seul groupe).
            final long totalNights = matching.stream().mapToLong(g -> g.nights).sum();
            for (Group group : matching) {
                final BigDecimal share = totalNights == 0
                        ? divide4(cost, matching.size())
                        : cost.multiply(BigDecimal.valueOf(group.nights))
                              .divide(BigDecimal.valueOf(totalNights), 4, RoundingMode.HALF_UP);
                group.costs = group.costs.add(share);
            }
        }
    }

    private static boolean matchesIgnoringChannel(List<String> key, List<Dimension> dimensions,
                                                  Granularity granularity, Property property, LocalDate day) {
        for (int i = 0; i < dimensions.size(); i++) {
            final boolean match = switch (dimensions.get(i)) {
                case PROPERTY -> key.get(i).equals(propertyLabel(property));
                case COUNTRY -> key.get(i).equals(countryOf(property));
                case PERIOD -> key.get(i).equals(bucketLabel(day, granularity));
                case CHANNEL -> true;
            };
            if (!match) {
                return false;
            }
        }
        return true;
    }

    // ── Métriques ───────────────────────────────────────────────────────────

    private static Map<String, Object> metricsOf(Group group, Set<Metric> metrics,
                                                 List<Dimension> dimensions, List<String> key,
                                                 long activeTotal, Map<String, Long> activeByCountry,
                                                 LocalDate from, LocalDate toExclusive) {
        final Map<String, Object> values = new LinkedHashMap<>();
        final long availableNights = availableNights(group, dimensions, key,
                activeTotal, activeByCountry, from, toExclusive);
        for (Metric metric : metrics) {
            switch (metric) {
                case REVENUE -> values.put("REVENUE", scale2(group.revenue));
                case FEES -> values.put("FEES", scale2(group.fees));
                case MARGIN -> values.put("MARGIN",
                        scale2(group.revenue.subtract(group.fees).subtract(group.costs)));
                case ADR -> {
                    if (group.nights > 0) {
                        values.put("ADR", divide(group.revenue, group.nights));
                    }
                }
                case REVPAR -> {
                    if (availableNights > 0) {
                        values.put("REVPAR", divide(group.revenue, availableNights));
                    }
                }
                case OCCUPANCY -> {
                    if (availableNights > 0) {
                        values.put("OCCUPANCY",
                                Math.min(100.0, Math.round(group.nights * 1000.0 / availableNights) / 10.0));
                    }
                }
            }
        }
        return values;
    }

    /** Nuits disponibles du périmètre du groupe : propriétés du scope x jours du bucket. */
    private static long availableNights(Group group, List<Dimension> dimensions, List<String> key,
                                        long activeTotal, Map<String, Long> activeByCountry,
                                        LocalDate from, LocalDate toExclusive) {
        long propertyCount = activeTotal;
        if (dimensions.contains(Dimension.PROPERTY)) {
            propertyCount = 1L;
        } else if (dimensions.contains(Dimension.COUNTRY)) {
            propertyCount = activeByCountry.getOrDefault(
                    key.get(dimensions.indexOf(Dimension.COUNTRY)), 0L);
        }
        final LocalDate start = group.bucketStart != null ? group.bucketStart : from;
        final LocalDate end = group.bucketEndExclusive != null ? group.bucketEndExclusive : toExclusive;
        return propertyCount * Math.max(0L, ChronoUnit.DAYS.between(start, end));
    }

    // ── Buckets de période (labels ISO triables) ────────────────────────────

    static String bucketLabel(LocalDate night, Granularity granularity) {
        return switch (granularity) {
            case DAY -> night.toString();
            case WEEK -> String.format("%d-W%02d",
                    night.get(IsoFields.WEEK_BASED_YEAR), night.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR));
            case MONTH -> YearMonth.from(night).toString();
            case YEAR -> String.valueOf(night.getYear());
        };
    }

    static LocalDate bucketStart(LocalDate night, Granularity granularity) {
        return switch (granularity) {
            case DAY -> night;
            case WEEK -> night.with(DayOfWeek.MONDAY);
            case MONTH -> night.withDayOfMonth(1);
            case YEAR -> night.withDayOfYear(1);
        };
    }

    static LocalDate bucketEndExclusive(LocalDate night, Granularity granularity) {
        return switch (granularity) {
            case DAY -> night.plusDays(1);
            case WEEK -> night.with(DayOfWeek.MONDAY).plusWeeks(1);
            case MONTH -> night.withDayOfMonth(1).plusMonths(1);
            case YEAR -> night.withDayOfYear(1).plusYears(1);
        };
    }

    // ── Utilitaires ─────────────────────────────────────────────────────────

    private static String channelOf(Reservation r) {
        return r.getSource() != null && !r.getSource().isBlank()
                ? r.getSource().toLowerCase(Locale.ROOT) : "autre";
    }

    private static String propertyLabel(Property property) {
        return property.getName() != null && !property.getName().isBlank()
                ? property.getName() : "#" + property.getId();
    }

    private static String countryOf(Property property) {
        return property.getCountry() != null && !property.getCountry().isBlank()
                ? property.getCountry() : "—";
    }

    private static BigDecimal nz(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private static BigDecimal divide(BigDecimal value, long divisor) {
        return value.divide(BigDecimal.valueOf(Math.max(1L, divisor)), 2, RoundingMode.HALF_UP);
    }

    private static BigDecimal divide4(BigDecimal value, long divisor) {
        return value.divide(BigDecimal.valueOf(Math.max(1L, divisor)), 4, RoundingMode.HALF_UP);
    }

    private static BigDecimal scale2(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private static LocalDate max(LocalDate a, LocalDate b) {
        return a.isAfter(b) ? a : b;
    }

    private static LocalDate min(LocalDate a, LocalDate b) {
        return a.isBefore(b) ? a : b;
    }
}
