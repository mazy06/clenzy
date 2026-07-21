package com.clenzy.booking.service;

import com.clenzy.booking.dto.PropertyCalendarDto;
import com.clenzy.booking.dto.PropertyCalendarDto.CalendarDayDto;
import com.clenzy.booking.dto.PropertySearchFilters;
import com.clenzy.booking.dto.PublicPropertyDto;
import com.clenzy.booking.model.DataSourceMode;
import com.clenzy.booking.service.PublicBookingService.OrgContext;
import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.model.Property;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.CurrencyConverterService;
import com.clenzy.service.PriceEngine;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
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
    private final CurrencyConverterService currencyConverter;
    /** Jeu de démo servi quand la config est en mode {@link DataSourceMode#MOCK}. */
    private final BookingMockDataProvider mockDataProvider;

    public PublicBookingCalendarService(PropertyRepository propertyRepository,
                                  CalendarDayRepository calendarDayRepository,
                                  PriceEngine priceEngine,
                                  CurrencyConverterService currencyConverter,
                                  BookingMockDataProvider mockDataProvider) {
        this.propertyRepository = propertyRepository;
        this.calendarDayRepository = calendarDayRepository;
        this.priceEngine = priceEngine;
        this.currencyConverter = currencyConverter;
        this.mockDataProvider = mockDataProvider;
    }

    /** {@code true} si le booking engine du ctx est en mode démo (données mock). */
    private static boolean isMock(OrgContext ctx) {
        return ctx.config() != null && ctx.config().getDataSourceMode() == DataSourceMode.MOCK;
    }

    @Transactional(readOnly = true)
    public PropertyCalendarDto getCalendar(OrgContext ctx, Long propertyId, YearMonth from, int months) {
        if (isMock(ctx)) {
            return mockDataProvider.getCalendar(propertyId, from, months);
        }
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

    /**
     * Calendrier AGRÉGÉ pour la recherche : par jour, le prix nuitée le PLUS BAS parmi les logements qui
     * matchent les filtres + la capacité voyageurs ET disponibles ce jour-là. Un jour sans aucun logement
     * disponible est marqué non disponible (grisé côté front). `propertyId = 0` (agrégat, pas une propriété).
     *
     * NB perf : 1 requête CalendarDay + 1 résolution PriceEngine par logement filtré. Acceptable à l'échelle
     * d'une conciergerie (dizaines de biens) ; mettre en cache (Redis) si le catalogue grossit.
     */
    // Cle alignee sur searchCacheKey : inclut configId, dataSourceMode et
    // featuredPropertyIds — sans eux, deux engines d'une meme org (ou un engine
    // MOCK vs REEL) partageaient leurs entrees de cache.
    @org.springframework.cache.annotation.Cacheable(
            value = "booking-engine-price-calendar",
            key = "T(com.clenzy.booking.service.PublicBookingService).searchCacheKey('calendar', #ctx, #currency, #filters)"
                    + " + ':' + #from + ':' + #months + ':' + #guests")
    @Transactional(readOnly = true)
    public PropertyCalendarDto getPriceCalendar(OrgContext ctx, PropertySearchFilters filters, Integer guests,
                                                YearMonth from, int months, String currency) {
        if (isMock(ctx)) {
            return mockDataProvider.getPriceCalendar(from, months);
        }
        Long orgId = ctx.orgId();
        Set<Long> featured = PublicBookingService.parseFeaturedPropertyIds(ctx.config().getFeaturedPropertyIds());
        List<Property> props = propertyRepository.findBookingEngineVisible(orgId).stream()
            .filter(p -> featured.isEmpty() || featured.contains(p.getId()))
            .filter(p -> guests == null || guests <= 0 || (p.getMaxGuests() != null && p.getMaxGuests() >= guests))
            .filter(p -> filters == null || filters.matches(PublicPropertyDto.from(p)))
            .toList();

        int span = Math.max(1, Math.min(months, MAX_MONTHS));
        LocalDate start = from.atDay(1);
        LocalDate end = from.plusMonths(span - 1L).atEndOfMonth();
        // Devise cible = devise d'affichage demandée (sinon devise du 1er logement). On convertit le prix de
        // CHAQUE logement vers cette devise AVANT le min → comparaison cohérente en multi-devise.
        final String target = (currency != null && !currency.isBlank()) ? currency : null;
        final LocalDate rateDate = LocalDate.now();

        Map<LocalDate, BigDecimal> minPrice = new HashMap<>();
        String resultCurrency = target;
        for (Property p : props) {
            final String propCurrency = p.getDefaultCurrency() != null ? p.getDefaultCurrency() : "EUR";
            if (resultCurrency == null) resultCurrency = propCurrency; // pas de devise demandée → devise du 1er logement
            LocalDate today = LocalDate.now(resolveZone(p.getTimezone()));
            Set<LocalDate> unavailable = calendarDayRepository.findByPropertyAndDateRange(p.getId(), start, end, orgId).stream()
                .filter(cd -> cd.getStatus() != CalendarDayStatus.AVAILABLE)
                .map(CalendarDay::getDate)
                .collect(Collectors.toSet());
            Map<LocalDate, BigDecimal> priceMap = priceEngine.resolvePriceRange(p.getId(), start, end.plusDays(1), orgId);
            for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
                if (d.isBefore(today) || unavailable.contains(d)) continue;
                BigDecimal price = priceMap.get(d);
                if (price == null || price.compareTo(BigDecimal.ZERO) <= 0) continue;
                BigDecimal converted = target != null ? currencyConverter.convert(price, propCurrency, target, rateDate) : price;
                if (converted == null) continue;
                minPrice.merge(d, converted, (a, b) -> a.compareTo(b) <= 0 ? a : b);
            }
        }
        if (resultCurrency == null) resultCurrency = "EUR"; // aucun logement filtré

        List<CalendarDayDto> days = new ArrayList<>();
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            BigDecimal price = minPrice.get(d);
            // available = au moins un logement filtré dispo+tarifé ce jour (sinon le front grise le jour).
            days.add(new CalendarDayDto(d, price != null, price, 1, false, false));
        }
        return new PropertyCalendarDto(0L, resultCurrency, days);
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
