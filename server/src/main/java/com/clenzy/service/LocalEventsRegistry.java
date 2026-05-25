package com.clenzy.service;

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
    private List<LocalEvent> events = Collections.emptyList();

    public LocalEventsRegistry(ObjectMapper objectMapper,
                                @Value("classpath:data/local_events.json") Resource dataResource) {
        this.objectMapper = objectMapper;
        this.dataResource = dataResource;
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
     *
     * @param city ville cible (sensible casse normalisee) — null/blank = toutes
     * @param from date de debut inclusive (null = pas de borne min)
     * @param to   date de fin inclusive (null = pas de borne max)
     * @return liste triee par date ASC
     */
    public List<LocalEvent> findByCityAndDateRange(String city, LocalDate from, LocalDate to) {
        if (events.isEmpty()) return List.of();
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
        filtered.sort((a, b) -> a.date.compareTo(b.date));
        return filtered;
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
