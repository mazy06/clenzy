package com.clenzy.service;

import com.clenzy.model.CalendarDay;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Grille de prix du planning : prix resolu, source, statut et reservation liee,
 * jour par jour, pour un lot de logements.
 *
 * <p>Le corps vivait dans {@code CalendarController}, qui l'executait logement
 * par logement et SANS transaction. Pour une seule fenetre de planning
 * (10 logements × 5 tranches de 30 jours) cela faisait ~200 requetes SQL — dont
 * la moitie strictement redondante, les plans tarifaires et la fiche logement
 * ne dependant pas de la plage de dates — reparties sur ~200 transactions
 * distinctes, chacune prenant et rendant une connexion du pool.</p>
 *
 * <p>Ici : <b>une</b> transaction en lecture seule (donc une connexion, et le
 * routage vers la replica de lecture) et un nombre CONSTANT de requetes — 4 —
 * quel que soit le nombre de logements.</p>
 */
@Service
public class PlanningPricingService {

    private final CalendarEngine calendarEngine;
    private final PriceEngine priceEngine;

    public PlanningPricingService(CalendarEngine calendarEngine, PriceEngine priceEngine) {
        this.calendarEngine = calendarEngine;
        this.priceEngine = priceEngine;
    }

    /**
     * Lignes « prix du jour » sur [from, to) pour chaque logement demande.
     *
     * @param includePropertyId ajoute le propertyId a chaque ligne — indispensable
     *                          en lot, ou les lignes de tous les logements sont
     *                          melees dans une seule liste.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> pricingRows(Collection<Long> propertyIds, LocalDate from,
                                                 LocalDate to, Long orgId, boolean includePropertyId) {
        List<Map<String, Object>> result = new ArrayList<>();
        if (propertyIds == null || propertyIds.isEmpty()) return result;

        // Ordre d'appel preserve : le client peut s'y fier pour l'affichage.
        Set<Long> ids = new LinkedHashSet<>(propertyIds);

        // 1 requete pour les jours calendrier de tout le lot…
        Map<Long, Map<LocalDate, CalendarDay>> daysByProperty = calendarEngine
                .getDays(ids, from, to, orgId).stream()
                .collect(Collectors.groupingBy(
                        day -> day.getProperty().getId(),
                        Collectors.toMap(CalendarDay::getDate, day -> day, (a, b) -> a)));

        // …et 3 pour la cascade de prix (overrides, plans, prix de repli).
        Map<Long, Map<LocalDate, PriceEngine.ResolvedPrice>> pricesByProperty =
                priceEngine.resolvePriceRangeWithSourceForProperties(ids, from, to, orgId);

        for (Long propertyId : ids) {
            Map<LocalDate, CalendarDay> dayMap = daysByProperty.getOrDefault(propertyId, Map.of());
            Map<LocalDate, PriceEngine.ResolvedPrice> prices =
                    pricesByProperty.getOrDefault(propertyId, Map.of());

            for (LocalDate date = from; date.isBefore(to); date = date.plusDays(1)) {
                Map<String, Object> entry = new LinkedHashMap<>();
                if (includePropertyId) entry.put("propertyId", propertyId);
                entry.put("date", date.toString());

                PriceEngine.ResolvedPrice resolved = prices.get(date);
                entry.put("nightlyPrice", resolved != null && resolved.price() != null
                        ? resolved.price().doubleValue() : null);

                CalendarDay day = dayMap.get(date);
                entry.put("status", day != null ? day.getStatus().name() : "AVAILABLE");
                entry.put("reservationId", day != null && day.getReservation() != null
                        ? day.getReservation().getId() : null);

                entry.put("priceSource", resolved != null
                        ? resolved.source() : PriceEngine.SOURCE_PROPERTY_DEFAULT);

                result.add(entry);
            }
        }

        return result;
    }
}
