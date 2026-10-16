package com.clenzy.service;

import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * État du jour de chaque logement, pour l'anneau de couleur des épingles de la
 * carte : on lit le planning d'un coup d'œil, sans ouvrir le calendrier.
 *
 * <p>« Aujourd'hui » est celui du LOGEMENT (son fuseau, repli Europe/Paris —
 * règle audit n°9) : à 23 h à Paris, un logement de Riyad est déjà au lendemain.</p>
 */
@Service
public class PropertyMapStateService {

    /** États, du plus urgent au plus calme ; les logements libres ne sont pas listés. */
    public enum State { TURNOVER, ARRIVAL, DEPARTURE, OCCUPIED }

    public record PropertyMapState(Long propertyId, State state) {}

    private static final ZoneId DEFAULT_ZONE = ZoneId.of("Europe/Paris");

    private final ReservationRepository reservationRepository;
    private final TenantContext tenantContext;
    private final Clock clock;

    public PropertyMapStateService(ReservationRepository reservationRepository, TenantContext tenantContext, Clock clock) {
        this.reservationRepository = reservationRepository;
        this.tenantContext = tenantContext;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<PropertyMapState> todayStates() {
        LocalDate utcToday = LocalDate.now(clock);
        // Fenêtre élargie d'un jour de part et d'autre : couvre tous les fuseaux.
        List<Reservation> window = reservationRepository.findOverlappingWindowForDashboard(
                utcToday.minusDays(1), utcToday.plusDays(2), tenantContext.getRequiredOrganizationId(), null);
        Map<Long, State> states = new HashMap<>();
        for (Reservation reservation : window) {
            if ("cancelled".equalsIgnoreCase(reservation.getStatus())) continue;
            Property property = reservation.getProperty();
            if (property == null) continue;
            LocalDate today = LocalDate.now(clock.withZone(zoneOf(property)));
            State state = stateOf(reservation.getCheckIn(), reservation.getCheckOut(), today);
            if (state != null) states.merge(property.getId(), state, PropertyMapStateService::moreUrgent);
        }
        List<PropertyMapState> result = new ArrayList<>(states.size());
        states.forEach((propertyId, state) -> result.add(new PropertyMapState(propertyId, state)));
        return result;
    }

    /** État d'un séjour pour un jour donné (le départ et l'arrivée du même logement fusionnent en rotation). */
    static State stateOf(LocalDate checkIn, LocalDate checkOut, LocalDate today) {
        if (checkIn == null || checkOut == null) return null;
        if (checkIn.equals(today)) return State.ARRIVAL;
        if (checkOut.equals(today)) return State.DEPARTURE;
        if (checkIn.isBefore(today) && checkOut.isAfter(today)) return State.OCCUPIED;
        return null;
    }

    static State moreUrgent(State a, State b) {
        if ((a == State.ARRIVAL && b == State.DEPARTURE) || (a == State.DEPARTURE && b == State.ARRIVAL)) {
            return State.TURNOVER;
        }
        return a.ordinal() <= b.ordinal() ? a : b;
    }

    private static ZoneId zoneOf(Property property) {
        try {
            return property.getTimezone() == null ? DEFAULT_ZONE : ZoneId.of(property.getTimezone());
        } catch (DateTimeException e) {
            return DEFAULT_ZONE;
        }
    }
}
