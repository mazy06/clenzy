package com.clenzy.service;

import com.clenzy.dto.PropertyPerformanceDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.CalendarDay;
import com.clenzy.model.Intervention;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.Reservation;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Score de performance d'un logement sur une fenêtre glissante (défaut 90 j).
 *
 * <p>Read-only. Reprend la logique du calcul front {@code computePropertyPerformance}
 * mais côté serveur, sur données réelles, avec les définitions standard de
 * {@link AccommodationKpis} : revenu = CA hébergement seul proraté aux nuits comprises
 * dans la fenêtre, occupation et RevPAN rapportés aux <b>nuits disponibles</b> (hors
 * blocages non vendus), occupation <b>plafonnée à 100 %</b>, marge nette calculée avec
 * les <b>coûts d'intervention réels</b> du logement (le front passait {@code interventions=[]}
 * → marge toujours à 100 %). La fenêtre compte exactement {@code windowDays} nuits,
 * la dernière étant celle de ce soir. L'org provient du logement chargé ; l'ownership
 * est validé côté controller avant l'appel.</p>
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
    private final CalendarDayRepository calendarDayRepository;
    private final Clock clock;

    public PropertyPerformanceService(PropertyRepository propertyRepository,
                                      ReservationRepository reservationRepository,
                                      InterventionRepository interventionRepository,
                                      CalendarDayRepository calendarDayRepository,
                                      Clock clock) {
        this.propertyRepository = propertyRepository;
        this.reservationRepository = reservationRepository;
        this.interventionRepository = interventionRepository;
        this.calendarDayRepository = calendarDayRepository;
        this.clock = clock;
    }

    /** Performance du logement sur la fenêtre par défaut. */
    public PropertyPerformanceDto compute(Long propertyId) {
        return compute(propertyId, DEFAULT_WINDOW_DAYS);
    }

    /**
     * Taux d'occupation (%) sur une fenêtre FUTURE {@code [today, today+days)} =
     * nuits vendues / nuits disponibles, plafonné à 100. Contrairement à {@link #compute}
     * (rétrospectif = score de performance), cette vue AVANT sert les décisions
     * tarifaires : une remise remplit des nuits à venir, on la déclenche donc sur les
     * nuits creuses futures — une nuit bloquée n'est pas une nuit creuse.
     */
    public double forwardOccupancyRate(Long propertyId, int days) {
        final int window = days > 0 ? days : DEFAULT_WINDOW_DAYS;
        final Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new NotFoundException("Logement introuvable : " + propertyId));
        final Long orgId = property.getOrganizationId();
        final LocalDate start = LocalDate.now(clock);
        final LocalDate endExclusive = start.plusDays(window);

        final List<Reservation> stays = withoutCancelled(reservationRepository.findByPropertyId(propertyId, orgId));
        long occupiedNights = 0L;
        for (Reservation r : stays) {
            occupiedNights += AccommodationKpis.nightsWithin(r, start, endExclusive);
        }
        final int availableNights = window - AccommodationKpis.closedUnsoldNights(
                closedDates(propertyId, start, endExclusive, orgId),
                AccommodationKpis.soldNights(stays, start, endExclusive), start, endExclusive);
        return round1(occupancyPercent(occupiedNights, availableNights));
    }

    public PropertyPerformanceDto compute(Long propertyId, int windowDays) {
        final Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new NotFoundException("Logement introuvable : " + propertyId));
        final Long orgId = property.getOrganizationId();
        final Window window = window(windowDays);
        return computeForProperty(property, window,
                reservationRepository.findByPropertyId(propertyId, orgId),
                interventionRepository.findByPropertyId(propertyId, orgId),
                closedDates(propertyId, window.start(), window.endExclusive(), orgId));
    }

    /**
     * Performance de tous les logements ACTIFS d'une org, triés par score
     * décroissant (classement du dashboard). Org-scopé strict.
     *
     * <p>Chargement BATCH : une requête réservations + une requête interventions
     * + une requête jours fermés pour toute l'org (fenêtre pré-filtrée en SQL), puis
     * agrégation en mémoire — l'ancienne version faisait 2 requêtes PAR logement
     * (N+1, audit perf).</p>
     */
    public List<PropertyPerformanceDto> computeSummaries(Long orgId, int windowDays) {
        final List<Property> actives = propertyRepository.findByOrganizationIdAndStatus(orgId, PropertyStatus.ACTIVE);
        if (actives.isEmpty()) {
            return List.of();
        }

        final Window window = window(windowDays);
        final List<Long> ids = actives.stream().map(Property::getId).toList();

        // Les réservations hors fenêtre contribuent 0 nuit / 0 revenu : le
        // pré-filtre SQL par chevauchement est sans effet sur le résultat.
        final Map<Long, List<Reservation>> reservationsByProperty = reservationRepository
                .findByPropertyIdsOverlappingWindow(ids, window.start(), window.endExclusive(), orgId).stream()
                .collect(Collectors.groupingBy(r -> r.getProperty().getId()));
        final Map<Long, List<Intervention>> interventionsByProperty = interventionRepository
                .findByPropertyIdsAndScheduledDateRange(
                        ids, window.start().atStartOfDay(), window.endExclusive().atStartOfDay(), orgId).stream()
                .collect(Collectors.groupingBy(i -> i.getProperty().getId()));
        final Map<Long, Set<LocalDate>> closedDatesByProperty = calendarDayRepository
                .findBlockedOrMaintenanceForProperties(ids, window.start(), window.endExclusive(), orgId).stream()
                .collect(Collectors.groupingBy(cd -> cd.getProperty().getId(),
                        Collectors.mapping(CalendarDay::getDate, Collectors.toSet())));

        return actives.stream()
                .map(p -> computeForProperty(p, window,
                        reservationsByProperty.getOrDefault(p.getId(), List.of()),
                        interventionsByProperty.getOrDefault(p.getId(), List.of()),
                        closedDatesByProperty.getOrDefault(p.getId(), Set.of())))
                .sorted(Comparator.comparingInt(PropertyPerformanceDto::score).reversed())
                .toList();
    }

    /**
     * Fenêtre rétrospective de {@code days} nuits dont la dernière est celle de ce soir :
     * {@code [today − days + 1, today + 1)} (une nuit = [checkIn, checkOut)).
     */
    private record Window(LocalDate start, LocalDate endExclusive, int days) {}

    private Window window(int windowDays) {
        final int days = windowDays > 0 ? windowDays : DEFAULT_WINDOW_DAYS;
        final LocalDate today = LocalDate.now(clock);
        return new Window(today.minusDays(days - 1L), today.plusDays(1), days);
    }

    /** Jours du logement retirés de la vente (BLOCKED / MAINTENANCE) sur [from, to). */
    private Set<LocalDate> closedDates(Long propertyId, LocalDate from, LocalDate to, Long orgId) {
        return calendarDayRepository.findBlockedOrMaintenanceForProperties(List.of(propertyId), from, to, orgId)
                .stream()
                .map(CalendarDay::getDate)
                .collect(Collectors.toSet());
    }

    private PropertyPerformanceDto computeForProperty(Property property, Window window,
                                                      List<Reservation> reservations,
                                                      List<Intervention> interventions,
                                                      Set<LocalDate> closedDates) {
        final LocalDate windowStart = window.start();
        final LocalDate windowEndExclusive = window.endExclusive();

        final List<Reservation> stays = withoutCancelled(reservations);
        long occupiedNights = 0L;
        BigDecimal revenue = BigDecimal.ZERO;
        for (Reservation r : stays) {
            occupiedNights += AccommodationKpis.nightsWithin(r, windowStart, windowEndExclusive);
            revenue = revenue.add(AccommodationKpis.proratedAccommodationRevenue(r, windowStart, windowEndExclusive));
        }
        final int availableNights = window.days() - AccommodationKpis.closedUnsoldNights(closedDates,
                AccommodationKpis.soldNights(stays, windowStart, windowEndExclusive), windowStart, windowEndExclusive);

        BigDecimal costs = BigDecimal.ZERO;
        for (Intervention i : interventions) {
            if (i.getScheduledDate() == null) {
                continue;
            }
            final LocalDate d = i.getScheduledDate().toLocalDate();
            if (d.isBefore(windowStart) || !d.isBefore(windowEndExclusive)) {
                continue;
            }
            final BigDecimal cost = i.getActualCost() != null ? i.getActualCost()
                    : (i.getEstimatedCost() != null ? i.getEstimatedCost() : BigDecimal.ZERO);
            costs = costs.add(cost);
        }

        final double occupancyRate = occupancyPercent(occupiedNights, availableNights);
        final BigDecimal revPan = availableNights > 0
                ? revenue.divide(BigDecimal.valueOf(availableNights), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO.setScale(2);
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
                property.getId(),
                property.getName(),
                score,
                revPan,
                round1(occupancyRate),
                revenue.setScale(2, RoundingMode.HALF_UP),
                costs.setScale(2, RoundingMode.HALF_UP),
                round1(netMargin),
                window.days());
    }

    private static List<Reservation> withoutCancelled(List<Reservation> reservations) {
        return reservations.stream().filter(r -> !AccommodationKpis.isCancelled(r)).toList();
    }

    /** Occupation en % = nuits vendues / nuits disponibles, plafonnée à 100 (0 sans nuit en vente). */
    private static double occupancyPercent(long occupiedNights, int availableNights) {
        return availableNights > 0 ? Math.min(100.0, occupiedNights * 100.0 / availableNights) : 0.0;
    }

    private static double clamp(double v, double lo, double hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
