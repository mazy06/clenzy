package com.clenzy.service;

import com.clenzy.integration.holidays.PublicHolidaysClient;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Registre statique d'evenements locaux (jours feries FR + grands evenements
 * publics 2026-2027). Charge le dataset {@code data/local_events.json} au
 * boot Spring et l'expose en lecture seule.
 *
 * <p>Convention : un evenement avec {@code city = "*"} s'applique a toutes
 * les villes (utilise pour les jours feries nationaux).</p>
 *
 * <p>Si le fichier est introuvable ou invalide, le registre demarre vide
 * (warn log) — le tool retournera "aucun evenement".</p>
 */
@Service
public class LocalEventsRegistry {

    private static final Logger log = LoggerFactory.getLogger(LocalEventsRegistry.class);
    private static final String WILDCARD_CITY = "*";

    private final ObjectMapper objectMapper;
    private final Resource dataResource;
    private final PublicHolidaysClient publicHolidaysClient;
    private List<LocalEvent> events = Collections.emptyList();

    public LocalEventsRegistry(ObjectMapper objectMapper,
                                @Value("classpath:data/local_events.json") Resource dataResource,
                                Optional<PublicHolidaysClient> publicHolidaysClient) {
        this.objectMapper = objectMapper;
        this.dataResource = dataResource;
        this.publicHolidaysClient = publicHolidaysClient.orElse(null);
    }

    @PostConstruct
    void loadDataset() {
        if (!dataResource.exists()) {
            log.warn("LocalEventsRegistry: data/local_events.json introuvable — registre vide");
            return;
        }
        try (InputStream is = dataResource.getInputStream()) {
            EventsFile file = objectMapper.readValue(is, EventsFile.class);
            this.events = file != null && file.events != null
                    ? List.copyOf(file.events)
                    : List.of();
            log.info("LocalEventsRegistry: {} evenements charges", this.events.size());
        } catch (IOException e) {
            log.error("LocalEventsRegistry: parsing failed — registre vide", e);
            this.events = List.of();
        }
    }

    /**
     * Filtre les evenements applicables a une ville sur une plage [from, to].
     * Equivaut a {@link #findByCityAndDateRange(String, String, LocalDate, LocalDate)}
     * sans countryCode — pas d'agregation des jours feries API.
     */
    public List<LocalEvent> findByCityAndDateRange(String city, LocalDate from, LocalDate to) {
        return findByCityAndDateRange(city, null, from, to);
    }

    /**
     * Variante avec country : agrege les events YAML statiques + les jours
     * feries officiels (date.nager.at) si {@code countryCode} est fourni et le
     * {@link PublicHolidaysClient} est dispo.
     *
     * @param city        ville cible — null/blank = toutes
     * @param countryCode ISO-2 (FR, MA, ES) ; null/blank = pas d'agregation API
     * @param from        date de debut inclusive (null = pas de borne min)
     * @param to          date de fin inclusive (null = pas de borne max)
     * @return liste triee par date ASC, dedupliquee par (date, type=holiday)
     */
    public List<LocalEvent> findByCityAndDateRange(String city, String countryCode,
                                                     LocalDate from, LocalDate to) {
        String normalizedCity = (city == null || city.isBlank())
                ? null
                : city.trim().toLowerCase(Locale.ROOT);

        List<LocalEvent> filtered = new ArrayList<>();
        for (LocalEvent e : events) {
            if (e.date == null) continue;
            if (from != null && e.date.isBefore(from)) continue;
            if (to != null && e.date.isAfter(to)) continue;
            if (normalizedCity != null && !matchesCity(e.city, normalizedCity)) continue;
            filtered.add(e);
        }

        // Agregation des jours feries officiels via API (si dispo + country fourni)
        if (publicHolidaysClient != null && countryCode != null && !countryCode.isBlank()
                && from != null && to != null) {
            try {
                List<PublicHolidaysClient.PublicHoliday> holidays =
                        publicHolidaysClient.findInRange(countryCode, from, to);
                for (PublicHolidaysClient.PublicHoliday h : holidays) {
                    if (isAlreadyPresent(filtered, h)) continue;
                    filtered.add(toLocalEvent(h));
                }
            } catch (Exception e) {
                // Fail-soft : si l'API holidays casse, on garde juste les YAML.
                log.debug("Public holidays fetch failed for {}: {}", countryCode, e.getMessage());
            }
        }

        filtered.sort((a, b) -> a.date.compareTo(b.date));
        return filtered;
    }

    /**
     * Deduplication : si le YAML a deja un holiday a la meme date (ex: "1 Janvier
     * - Jour de l'an" code en dur), on ne re-insere pas le meme depuis l'API.
     * Heuristique simple : meme date + type contenant "holiday" ou "ferie".
     */
    private static boolean isAlreadyPresent(List<LocalEvent> existing,
                                              PublicHolidaysClient.PublicHoliday h) {
        for (LocalEvent e : existing) {
            if (!h.date().equals(e.date)) continue;
            if (e.type == null) continue;
            String t = e.type.toLowerCase(Locale.ROOT);
            if (t.contains("holiday") || t.contains("ferie")) return true;
        }
        return false;
    }

    private static LocalEvent toLocalEvent(PublicHolidaysClient.PublicHoliday h) {
        LocalEvent e = new LocalEvent();
        e.id = "holiday-" + h.countryCode() + "-" + h.date();
        e.title = h.localName() != null ? h.localName() : h.englishName();
        e.type = "public_holiday";
        e.city = WILDCARD_CITY;
        e.country = h.countryCode();
        e.date = h.date();
        e.description = h.englishName() != null
                ? "Jour ferie officiel (" + h.englishName() + ")"
                : "Jour ferie officiel";
        return e;
    }

    private static boolean matchesCity(String eventCity, String requestedNormalized) {
        if (eventCity == null) return false;
        if (WILDCARD_CITY.equals(eventCity)) return true;
        return eventCity.trim().toLowerCase(Locale.ROOT).equals(requestedNormalized);
    }

    /** Taille du dataset (utile aux tests + observabilite). */
    public int size() {
        return events.size();
    }

    // ─── DTOs ───────────────────────────────────────────────────────────────

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class LocalEvent {
        public String id;
        public String title;
        public String type;
        public String city;
        public String country;
        public LocalDate date;
        public String description;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class EventsFile {
        public List<LocalEvent> events;
    }
}
