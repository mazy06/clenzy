package com.clenzy.service;

import com.clenzy.dto.PropertyPerformanceDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Intervention;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.Reservation;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Score de performance d'un logement sur une fenêtre glissante (défaut 90 j).
 *
 * <p>Read-only. Reprend la logique du calcul front {@code computePropertyPerformance}
 * mais côté serveur, sur données réelles : revenu proraté aux nuits comprises dans
 * la fenêtre, occupation <b>plafonnée à 100 %</b>, marge nette calculée avec les
 * <b>coûts d'intervention réels</b> du logement (le front passait {@code interventions=[]}
 * → marge toujours à 100 %). L'org provient du logement chargé ; l'ownership est
 * validé côté controller avant l'appel.</p>
 */
@Service
@Transactional(readOnly = true)
public class PropertyPerformanceService {

    /** Fenêtre glissante par défaut (jours) — cohérente avec le palier « 90 j » du dashboard. */
    public static final int DEFAULT_WINDOW_DAYS = 90;

    /** Normalisation du RevPAN pour le score (au-delà, contribution plafonnée). */
    private static final BigDecimal REVPAN_NORM = BigDecimal.valueOf(200);

    private final PropertyRepository propertyRepository;
    private final ReservationRepository reservationRepository;
    private final InterventionRepository interventionRepository;
    private final Clock clock;

    public PropertyPerformanceService(PropertyRepository propertyRepository,
                                      ReservationRepository reservationRepository,
                                      InterventionRepository interventionRepository,
                                      Clock clock) {
        this.propertyRepository = propertyRepository;
        this.reservationRepository = reservationRepository;
        this.interventionRepository = interventionRepository;
        this.clock = clock;
    }

    /** Performance du logement sur la fenêtre par défaut. */
    public PropertyPerformanceDto compute(Long propertyId) {
        return compute(propertyId, DEFAULT_WINDOW_DAYS);
    }

    /**
     * Taux d'occupation (%) sur une fenêtre FUTURE {@code [today, today+days)},
     * plafonné à 100. Contrairement à {@link #compute} (rétrospectif = score de
     * performance), cette vue AVANT sert les décisions tarifaires : une remise
     * remplit des nuits à venir, on la déclenche donc sur les nuits creuses futures.
     */
    public double forwardOccupancyRate(Long propertyId, int days) {
        final int window = days > 0 ? days : DEFAULT_WINDOW_DAYS;
        final Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new NotFoundException("Logement introuvable : " + propertyId));
        final Long orgId = property.getOrganizationId();
        final LocalDate start = LocalDate.now(clock);
        final LocalDate endExclusive = start.plusDays(window);

        long occupiedNights = 0L;
        for (Reservation r : reservationRepository.findByPropertyId(propertyId, orgId)) {
            if ("cancelled".equalsIgnoreCase(r.getStatus())) {
                continue;
            }
            final LocalDate s = r.getCheckIn().isBefore(start) ? start : r.getCheckIn();
            final LocalDate e = r.getCheckOut().isBefore(endExclusive) ? r.getCheckOut() : endExclusive;
            occupiedNights += Math.max(0L, ChronoUnit.DAYS.between(s, e));
        }
        return round1(Math.min(100.0, (occupiedNights * 100.0) / window));
    }

    public PropertyPerformanceDto compute(Long propertyId, int windowDays) {
        final Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new NotFoundException("Logement introuvable : " + propertyId));
        final Long orgId = property.getOrganizationId();
        return computeForProperty(property, windowDays,
                reservationRepository.findByPropertyId(propertyId, orgId),
                interventionRepository.findByPropertyId(propertyId, orgId));
    }

    /**
     * Performance de tous les logements ACTIFS d'une org, triés par score
     * décroissant (classement du dashboard). Org-scopé strict.
     *
     * <p>Chargement BATCH : une requête réservations + une requête interventions
     * pour toute l'org (fenêtre pré-filtrée en SQL), puis agrégation en mémoire —
     * l'ancienne version faisait 2 requêtes PAR logement (N+1, audit perf).</p>
     */
    public List<PropertyPerformanceDto> computeSummaries(Long orgId, int windowDays) {
        final List<Property> actives = propertyRepository.findByOrganizationIdAndStatus(orgId, PropertyStatus.ACTIVE);
        if (actives.isEmpty()) {
            return List.of();
        }

        final int days = windowDays > 0 ? windowDays : DEFAULT_WINDOW_DAYS;
        final LocalDate today = LocalDate.now(clock);
        final LocalDate windowStart = today.minusDays(days);
        final LocalDate windowEndExclusive = today.plusDays(1);
        final List<Long> ids = actives.stream().map(Property::getId).toList();

        // Les réservations hors fenêtre contribuent 0 nuit / 0 revenu : le
        // pré-filtre SQL par chevauchement est sans effet sur le résultat.
        final Map<Long, List<Reservation>> reservationsByProperty = reservationRepository
                .findByPropertyIdsOverlappingWindow(ids, windowStart, windowEndExclusive, orgId).stream()
                .collect(Collectors.groupingBy(r -> r.getProperty().getId()));
        final Map<Long, List<Intervention>> interventionsByProperty = interventionRepository
                .findByPropertyIdsAndScheduledDateRange(
                        ids, windowStart.atStartOfDay(), windowEndExclusive.atStartOfDay(), orgId).stream()
                .collect(Collectors.groupingBy(i -> i.getProperty().getId()));

        return actives.stream()
                .map(p -> computeForProperty(p, windowDays,
                        reservationsByProperty.getOrDefault(p.getId(), List.of()),
                        interventionsByProperty.getOrDefault(p.getId(), List.of())))
                .sorted(Comparator.comparingInt(PropertyPerformanceDto::score).reversed())
                .toList();
    }

    private PropertyPerformanceDto computeForProperty(Property property, int windowDays,
                                                      List<Reservation> reservations,
                                                      List<Intervention> interventions) {
        final int days = windowDays > 0 ? windowDays : DEFAULT_WINDOW_DAYS;
        final Long propertyId = property.getId();

        final LocalDate today = LocalDate.now(clock);
        final LocalDate windowStart = today.minusDays(days);
        // Bornes exclusives sur la nuit de départ (une nuit = [checkIn, checkOut)).
        final LocalDate windowEndExclusive = today.plusDays(1);

        long occupiedNights = 0L;
        BigDecimal revenue = BigDecimal.ZERO;
        for (Reservation r : reservations) {
            if ("cancelled".equalsIgnoreCase(r.getStatus())) {
                continue;
            }
            final LocalDate start = r.getCheckIn().isBefore(windowStart) ? windowStart : r.getCheckIn();
            final LocalDate endExcl = r.getCheckOut().isBefore(windowEndExclusive) ? r.getCheckOut() : windowEndExclusive;
            final long nights = Math.max(0L, ChronoUnit.DAYS.between(start, endExcl));
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

        BigDecimal costs = BigDecimal.ZERO;
        for (Intervention i : interventions) {
            if (i.getScheduledDate() == null) {
                continue;
            }
            final LocalDate d = i.getScheduledDate().toLocalDate();
            if (d.isBefore(windowStart) || d.isAfter(today)) {
                continue;
            }
            final BigDecimal cost = i.getActualCost() != null ? i.getActualCost()
                    : (i.getEstimatedCost() != null ? i.getEstimatedCost() : BigDecimal.ZERO);
            costs = costs.add(cost);
        }

        final double occupancyRate = Math.min(100.0, (occupiedNights * 100.0) / days);
        final BigDecimal revPan = revenue.divide(BigDecimal.valueOf(days), 2, RoundingMode.HALF_UP);
        final double netMargin = revenue.signum() > 0
                ? clamp((revenue.subtract(costs)).multiply(BigDecimal.valueOf(100))
                        .divide(revenue, 1, RoundingMode.HALF_UP).doubleValue(), 0.0, 100.0)
                : 0.0;

        final double revPanScore = Math.min(revPan.doubleValue(), REVPAN_NORM.doubleValue())
                / REVPAN_NORM.doubleValue();
        final int score = (int) Math.min(100, Math.round(
                (occupancyRate / 100.0) * 40
                        + revPanScore * 30
                        + (netMargin / 100.0) * 30));

        return new PropertyPerformanceDto(
                propertyId,
                property.getName(),
                score,
                revPan,
                round1(occupancyRate),
                revenue.setScale(2, RoundingMode.HALF_UP),
                round1(netMargin),
                days);
    }

    private static double clamp(double v, double lo, double hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
