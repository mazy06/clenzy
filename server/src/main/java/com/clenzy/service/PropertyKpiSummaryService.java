package com.clenzy.service;

import com.clenzy.dto.PropertyKpiSummaryDto;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.InterventionType;
import com.clenzy.model.Reservation;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * KPI operationnels batches par propriete pour les cartes de la liste (mois courant).
 *
 * <p>Read-only, org-scope strict (l'org vient du contexte tenant cote controller).
 * Le {@code today} est passe par le controller : ces KPI sont des indicateurs
 * de dashboard non critiques, un seul {@code today} serveur (timezone Europe/Paris
 * par defaut) est acceptable plutot que la timezone de chaque propriete.</p>
 */
@Service
@Transactional(readOnly = true)
public class PropertyKpiSummaryService {

    private final ReservationRepository reservationRepository;
    private final InterventionRepository interventionRepository;

    public PropertyKpiSummaryService(ReservationRepository reservationRepository,
                                     InterventionRepository interventionRepository) {
        this.reservationRepository = reservationRepository;
        this.interventionRepository = interventionRepository;
    }

    public List<PropertyKpiSummaryDto> getSummaries(Long orgId, List<Long> ids, LocalDate today) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }

        final LocalDate monthStart = today.withDayOfMonth(1);
        final LocalDate monthEnd = today.withDayOfMonth(today.lengthOfMonth());
        final int daysInMonth = today.lengthOfMonth();

        // Reservations chevauchant le mois courant (filtre org cote repo), hors annulees.
        final Map<Long, List<Reservation>> reservationsByProperty = new HashMap<>();
        for (Reservation r : reservationRepository.findByPropertyIdsAndDateRange(ids, monthStart, monthEnd, orgId)) {
            if ("cancelled".equalsIgnoreCase(r.getStatus())) {
                continue;
            }
            reservationsByProperty
                .computeIfAbsent(r.getProperty().getId(), k -> new ArrayList<>())
                .add(r);
        }

        // Interventions en cours -> classification par propriete (premiere correspondance gagne).
        final Map<Long, String> interventionByProperty = new HashMap<>();
        for (Intervention i : interventionRepository.findActiveByPropertyIds(
                ids, List.of(InterventionStatus.IN_PROGRESS), orgId)) {
            final Long pid = i.getProperty().getId();
            if (interventionByProperty.containsKey(pid)) {
                continue;
            }
            InterventionType t = null;
            try {
                t = InterventionType.valueOf(i.getType());
            } catch (IllegalArgumentException ignored) {
                // type libre/non mappe -> traite comme maintenance ci-dessous
            }
            final String cls = (t != null && t.isCleaning()) ? "cleaning" : "maintenance";
            interventionByProperty.put(pid, cls);
        }

        final LocalDate monthEndExclusive = monthEnd.plusDays(1);
        final List<PropertyKpiSummaryDto> result = new ArrayList<>(ids.size());

        for (Long id : ids) {
            long bookedNights = 0L;
            BigDecimal revenueMonth = BigDecimal.ZERO;
            boolean occupied = false;
            LocalDate currentCheckOut = null;
            String currentCheckOutTime = null;

            for (Reservation r : reservationsByProperty.getOrDefault(id, List.of())) {
                final LocalDate nightsStart = r.getCheckIn().isBefore(monthStart) ? monthStart : r.getCheckIn();
                final LocalDate nightsEndExcl = r.getCheckOut().isBefore(monthEndExclusive)
                    ? r.getCheckOut() : monthEndExclusive;
                final long nights = Math.max(0L, ChronoUnit.DAYS.between(nightsStart, nightsEndExcl));
                final long totalNights = Math.max(1L, ChronoUnit.DAYS.between(r.getCheckIn(), r.getCheckOut()));

                bookedNights += nights;

                final BigDecimal price = r.getTotalPrice() != null ? r.getTotalPrice() : BigDecimal.ZERO;
                revenueMonth = revenueMonth.add(price
                    .multiply(BigDecimal.valueOf(nights))
                    .divide(BigDecimal.valueOf(totalNights), 2, RoundingMode.HALF_UP));

                // Occupe aujourd'hui : checkIn <= today <= checkOut. On garde le checkout le plus proche.
                if (!r.getCheckIn().isAfter(today) && !r.getCheckOut().isBefore(today)) {
                    occupied = true;
                    if (currentCheckOut == null || r.getCheckOut().isBefore(currentCheckOut)) {
                        currentCheckOut = r.getCheckOut();
                        currentCheckOutTime = r.getCheckOutTime();
                    }
                }
            }

            final double occupancy = daysInMonth > 0
                ? Math.min(1.0, (double) bookedNights / daysInMonth) : 0.0;
            final BigDecimal adr = bookedNights > 0
                ? revenueMonth.divide(BigDecimal.valueOf(bookedNights), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
            final BigDecimal revenue = revenueMonth.setScale(2, RoundingMode.HALF_UP);
            final String status = occupied ? "occupied" : "available";
            final String interv = interventionByProperty.get(id);
            final String checkOutIso = currentCheckOut != null ? currentCheckOut.toString() : null;

            result.add(new PropertyKpiSummaryDto(
                id, occupancy, adr, revenue, status, checkOutIso, currentCheckOutTime, interv));
        }

        return result;
    }
}
