package com.clenzy.booking.service;

import com.clenzy.booking.dto.PropertyCalendarDto;
import com.clenzy.booking.dto.PropertyCalendarDto.CalendarDayDto;
import com.clenzy.booking.service.PublicBookingService.OrgContext;
import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.model.Property;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.PriceEngine;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Grille de calendrier publique par propriété (CLZ Domaine 2) : disponibilité + prix nuitée +
 * min-nights par jour, pour alimenter la sélection de dates du widget. Réutilise la convention
 * Clenzy (absence de ligne {@code CalendarDay} = disponible) + {@link PriceEngine} pour le prix.
 * « Aujourd'hui » est évalué dans la timezone de la propriété (#9).
 */
@Service
public class PublicBookingCalendarService {

    private static final int MAX_MONTHS = 6;
    private static final ZoneId FALLBACK_ZONE = ZoneId.of("Europe/Paris");

    private final PropertyRepository propertyRepository;
    private final CalendarDayRepository calendarDayRepository;
    private final PriceEngine priceEngine;

    public PublicBookingCalendarService(PropertyRepository propertyRepository,
                                  CalendarDayRepository calendarDayRepository,
                                  PriceEngine priceEngine) {
        this.propertyRepository = propertyRepository;
        this.calendarDayRepository = calendarDayRepository;
        this.priceEngine = priceEngine;
    }

    @Transactional(readOnly = true)
    public PropertyCalendarDto getCalendar(OrgContext ctx, Long propertyId, YearMonth from, int months) {
        Long orgId = ctx.orgId();
        Property property = propertyRepository.findBookingEngineProperty(propertyId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable ou non visible"));

        int span = Math.max(1, Math.min(months, MAX_MONTHS));
        LocalDate start = from.atDay(1);
        LocalDate end = from.plusMonths(span - 1L).atEndOfMonth(); // dernier jour inclus
        LocalDate today = LocalDate.now(resolveZone(property.getTimezone()));
        int minNights = property.getMinimumNights() != null ? property.getMinimumNights() : 1;

        // Indisponibles = jours avec une ligne CalendarDay au statut != AVAILABLE (convention Clenzy).
        Set<LocalDate> unavailable = calendarDayRepository
            .findByPropertyAndDateRange(propertyId, start, end, orgId).stream()
            .filter(cd -> cd.getStatus() != CalendarDayStatus.AVAILABLE)
            .map(CalendarDay::getDate)
            .collect(Collectors.toSet());

        // Prix nuit par nuit (end exclusif côté PriceEngine -> end+1 pour inclure le dernier jour).
        Map<LocalDate, BigDecimal> priceMap = priceEngine.resolvePriceRange(propertyId, start, end.plusDays(1), orgId);

        String currency = property.getDefaultCurrency() != null ? property.getDefaultCurrency() : "EUR";
        List<CalendarDayDto> days = new ArrayList<>();
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            BigDecimal price = priceMap.get(d);
            boolean priced = price != null && price.compareTo(BigDecimal.ZERO) > 0;
            boolean available = !d.isBefore(today) && !unavailable.contains(d) && priced;
            days.add(new CalendarDayDto(d, available, priced ? price : null, minNights, false, false));
        }
        return new PropertyCalendarDto(propertyId, currency, days);
    }

    private ZoneId resolveZone(String tz) {
        if (tz == null || tz.isBlank()) {
            return FALLBACK_ZONE;
        }
        try {
            return ZoneId.of(tz);
        } catch (Exception e) {
            return FALLBACK_ZONE;
        }
    }
}
