package com.clenzy.service.agent.analytics;

import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.CalendarEngine;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Suggestions d'upsells (P2-14) — agent {@code com}.
 *
 * <p>Pour les séjours à venir, détecte les <b>opportunités d'upsell</b> à partir
 * des trous de calendrier autour de la réservation : nuit libre la veille (arrivée
 * anticipée / nuit en plus) ou le jour du départ (départ tardif / nuit en plus).
 * Read-only : <b>propose</b>, ne crée rien. Org-scopée.</p>
 */
@Service
public class UpsellSuggestionService {

    private static final int DEFAULT_WINDOW_DAYS = 30;
    private static final int MAX_WINDOW_DAYS = 120;
    private static final int MAX_SUGGESTIONS = 50;

    private final ReservationRepository reservationRepository;
    private final CalendarEngine calendarEngine;
    private final TenantContext tenantContext;
    private final Clock clock;

    public UpsellSuggestionService(ReservationRepository reservationRepository,
                                   CalendarEngine calendarEngine,
                                   TenantContext tenantContext,
                                   Clock clock) {
        this.reservationRepository = reservationRepository;
        this.calendarEngine = calendarEngine;
        this.tenantContext = tenantContext;
        this.clock = clock;
    }

    public record UpsellSuggestion(
            Long reservationId, Long propertyId, String propertyName, String guestName,
            String checkIn, String checkOut, List<String> upsells) {}

    public record UpsellResult(int windowDays, int count, List<UpsellSuggestion> suggestions, String headline) {}

    @Transactional(readOnly = true)
    public UpsellResult suggest(int windowDays) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        LocalDate today = LocalDate.now(clock);
        int window = Math.max(1, Math.min(windowDays, MAX_WINDOW_DAYS));
        LocalDate to = today.plusDays(window);

        List<UpsellSuggestion> suggestions = new ArrayList<>();
        for (Reservation r : reservationRepository.findConfirmedByCheckInRange(today, to, orgId)) {
            if (r.getProperty() == null || r.getCheckIn() == null || r.getCheckOut() == null) {
                continue;
            }
            Property p = r.getProperty();
            LocalDate nightBefore = r.getCheckIn().minusDays(1);
            LocalDate departureNight = r.getCheckOut(); // nuit du jour de départ

            Map<LocalDate, CalendarDayStatus> status = statusMap(p.getId(), nightBefore, departureNight, orgId);

            List<String> upsells = new ArrayList<>();
            if (isFree(status.get(nightBefore))) {
                upsells.add("Nuit supplémentaire la veille (arrivée anticipée possible)");
            }
            if (isFree(status.get(departureNight))) {
                upsells.add("Nuit supplémentaire au départ (départ tardif possible)");
            }
            if (upsells.isEmpty()) {
                continue;
            }
            suggestions.add(new UpsellSuggestion(r.getId(), p.getId(), p.getName(), r.getGuestName(),
                    r.getCheckIn().toString(), r.getCheckOut().toString(), upsells));
            if (suggestions.size() >= MAX_SUGGESTIONS) {
                break;
            }
        }

        return new UpsellResult(window, suggestions.size(), suggestions, headline(suggestions.size()));
    }

    private Map<LocalDate, CalendarDayStatus> statusMap(Long propertyId, LocalDate from, LocalDate to, Long orgId) {
        Map<LocalDate, CalendarDayStatus> map = new HashMap<>();
        for (CalendarDay d : calendarEngine.getDays(propertyId, from, to, orgId)) {
            if (d.getDate() != null) {
                map.put(d.getDate(), d.getStatus());
            }
        }
        return map;
    }

    /** Convention Clenzy : absence de ligne OU AVAILABLE = libre. */
    private static boolean isFree(CalendarDayStatus s) {
        return s == null || s == CalendarDayStatus.AVAILABLE;
    }

    private static String headline(int count) {
        return count == 0
                ? "Aucune opportunité d'upsell sur la période."
                : count + " séjour(s) avec une opportunité d'upsell (nuit en plus / arrivée ou départ flexible).";
    }
}
