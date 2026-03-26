package com.clenzy.booking.service;

import com.clenzy.booking.dto.AvailabilityDayDto;
import com.clenzy.booking.dto.CalendarAvailabilityResponseDto;
import com.clenzy.booking.dto.PropertyTypeInfoDto;
import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyType;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.PriceEngine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service de calendrier de disponibilite agrege pour le Booking Engine.
 *
 * Pour chaque jour de la plage demandee, agrege :
 * - le prix le plus bas parmi les logements disponibles
 * - le nombre de logements disponibles
 * - les types de logement disponibles
 *
 * Filtre optionnel par type de logement et nombre de voyageurs.
 */
@Service
@Transactional(readOnly = true)
public class BookingEngineCalendarService {

    private static final Logger log = LoggerFactory.getLogger(BookingEngineCalendarService.class);

    private final PropertyRepository propertyRepository;
    private final CalendarDayRepository calendarDayRepository;
    private final PriceEngine priceEngine;

    public BookingEngineCalendarService(PropertyRepository propertyRepository,
                                         CalendarDayRepository calendarDayRepository,
                                         PriceEngine priceEngine) {
        this.propertyRepository = propertyRepository;
        this.calendarDayRepository = calendarDayRepository;
        this.priceEngine = priceEngine;
    }

    /**
     * Calcule la disponibilite et les prix pour une plage de dates.
     *
     * @param orgId   organisation
     * @param from    premier jour (inclus)
     * @param to      dernier jour (inclus)
     * @param types   filtre par types de logement (null ou vide = tous)
     * @param guests  filtre par capacite min (null = pas de filtre)
     * @return calendrier agrege avec prix min et disponibilite par jour
     */
    public CalendarAvailabilityResponseDto getCalendarAvailability(
            Long orgId, LocalDate from, LocalDate to,
            List<String> types, Integer guests) {

        // 1. Recuperer les proprietes eligibles
        final List<Property> allVisible = propertyRepository.findBookingEngineVisible(orgId);

        List<Property> eligible = allVisible.stream()
                .filter(p -> types == null || types.isEmpty()
                        || types.contains(p.getType().name()))
                .filter(p -> guests == null || p.getMaxGuests() == null
                        || p.getMaxGuests() >= guests)
                .toList();

        if (eligible.isEmpty()) {
            return buildEmptyResponse(from, to, allVisible);
        }

        // 2. Batch : charger les jours bloques/reserves pour toutes les proprietes
        //    CalendarDay avec status != AVAILABLE dans la plage [from, to]
        final Set<Long> propertyIds = eligible.stream()
                .map(Property::getId).collect(Collectors.toSet());

        // Charger tous les CalendarDay non-AVAILABLE pour les proprietes eligibles
        final Map<Long, Set<LocalDate>> unavailableDays = buildUnavailableMap(
                propertyIds, from, to, orgId);

        // 3. Batch : resoudre les prix par propriete via PriceEngine
        //    to+1 car PriceEngine.resolvePriceRange utilise [from, to) exclusif
        final Map<Long, Map<LocalDate, BigDecimal>> pricesByProperty = new HashMap<>();
        for (final Property prop : eligible) {
            pricesByProperty.put(prop.getId(),
                    priceEngine.resolvePriceRange(prop.getId(), from, to.plusDays(1), orgId));
        }

        // 4. Agreger par jour
        final List<AvailabilityDayDto> days = new ArrayList<>();
        for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
            BigDecimal minPrice = null;
            int availableCount = 0;
            final Set<String> availableTypes = new LinkedHashSet<>();

            for (final Property prop : eligible) {
                final Set<LocalDate> blocked = unavailableDays.getOrDefault(prop.getId(), Set.of());
                if (blocked.contains(date)) {
                    continue; // logement indisponible ce jour
                }

                availableCount++;
                availableTypes.add(prop.getType().name());

                final BigDecimal price = pricesByProperty
                        .getOrDefault(prop.getId(), Map.of()).get(date);
                if (price != null && (minPrice == null || price.compareTo(minPrice) < 0)) {
                    minPrice = price;
                }
            }

            days.add(new AvailabilityDayDto(
                    date.toString(),
                    availableCount > 0,
                    minPrice != null ? minPrice.doubleValue() : null,
                    availableCount,
                    new ArrayList<>(availableTypes)
            ));
        }

        // 5. Construire les infos de types de logement (toujours sur allVisible, pas le filtre)
        final List<PropertyTypeInfoDto> propertyTypes = buildPropertyTypes(allVisible);

        return new CalendarAvailabilityResponseDto(days, propertyTypes);
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /**
     * Construit la map propertyId → Set de dates indisponibles.
     * Un jour est considere indisponible s'il a un CalendarDay avec status != AVAILABLE.
     * Les jours sans CalendarDay sont consideres disponibles (convention Clenzy).
     */
    private Map<Long, Set<LocalDate>> buildUnavailableMap(
            Set<Long> propertyIds, LocalDate from, LocalDate to, Long orgId) {

        // Single batch query instead of N+1
        final List<CalendarDay> allDays = calendarDayRepository
                .findByPropertiesAndDateRange(propertyIds, from, to, orgId);

        final Map<Long, Set<LocalDate>> result = new HashMap<>();
        for (final CalendarDay cd : allDays) {
            if (cd.getStatus() != CalendarDayStatus.AVAILABLE) {
                result.computeIfAbsent(cd.getProperty().getId(), k -> new HashSet<>())
                      .add(cd.getDate());
            }
        }
        return result;
    }

    /**
     * Construit les infos de types de logement a partir des proprietes visibles.
     */
    private List<PropertyTypeInfoDto> buildPropertyTypes(List<Property> properties) {
        final Map<PropertyType, List<Property>> byType = properties.stream()
                .collect(Collectors.groupingBy(Property::getType));

        return byType.entrySet().stream()
                .sorted(Comparator.comparing(e -> e.getKey().name()))
                .map(e -> {
                    final PropertyType type = e.getKey();
                    final List<Property> props = e.getValue();
                    final Double cheapest = props.stream()
                            .map(Property::getNightlyPrice)
                            .filter(Objects::nonNull)
                            .min(BigDecimal::compareTo)
                            .map(BigDecimal::doubleValue)
                            .orElse(null);
                    final Double cheapestCleaning = props.stream()
                            .map(Property::getCleaningBasePrice)
                            .filter(Objects::nonNull)
                            .filter(p -> p.compareTo(BigDecimal.ZERO) > 0)
                            .min(BigDecimal::compareTo)
                            .map(BigDecimal::doubleValue)
                            .orElse(null);
                    return new PropertyTypeInfoDto(
                            type.name(),
                            type.getDisplayName(),
                            props.size(),
                            cheapest,
                            cheapestCleaning
                    );
                })
                .toList();
    }

    /**
     * Construit une reponse vide (aucun logement eligible) avec tous les jours marques indisponibles.
     */
    private CalendarAvailabilityResponseDto buildEmptyResponse(
            LocalDate from, LocalDate to, List<Property> allVisible) {

        final List<AvailabilityDayDto> days = new ArrayList<>();
        for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
            days.add(new AvailabilityDayDto(date.toString(), false, null, 0, List.of()));
        }
        return new CalendarAvailabilityResponseDto(days, buildPropertyTypes(allVisible));
    }
}
