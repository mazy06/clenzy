package com.clenzy.integration.agoda.service;

import com.clenzy.integration.agoda.dto.AgodaAvailabilityDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;

/**
 * Service de synchronisation du calendrier Agoda.
 *
 * Ecoute le topic Kafka agoda.calendar.sync pour :
 * - Pousser les mises a jour de disponibilite vers Agoda (OUTBOUND)
 * - Mettre a jour les tarifs
 *
 * Agoda utilise un modele push : le PMS envoie les mises a jour
 * de disponibilite/tarifs vers l'API Supply.
 */
@Service
public class AgodaCalendarService {

    private static final Logger log = LoggerFactory.getLogger(AgodaCalendarService.class);

    private final AgodaApiClient agodaApiClient;

    public AgodaCalendarService(AgodaApiClient agodaApiClient) {
        this.agodaApiClient = agodaApiClient;
    }

    /**
     * Consumer Kafka pour les evenements calendrier Agoda.
     * Pousse les mises a jour de disponibilite vers l'API Supply Agoda.
     */
    @Transactional
    @KafkaListener(topics = "agoda.calendar.sync", groupId = "clenzy-agoda-calendar")
    public void handleCalendarSync(Map<String, Object> event) {
        String eventType = (String) event.get("event_type");
        String eventId = (String) event.get("event_id");

        log.info("Traitement evenement calendrier Agoda: {} ({})", eventType, eventId);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) event.get("data");
            if (data == null) {
                log.warn("Evenement calendrier Agoda sans data: {}", eventId);
                return;
            }

            switch (eventType) {
                case "availability.update" -> handleAvailabilityUpdate(data);
                case "rate.update" -> handleRateUpdate(data);
                default -> log.warn("Type d'evenement calendrier Agoda inconnu: {}", eventType);
            }

        } catch (Exception e) {
            log.error("Erreur traitement calendrier Agoda {}: {}", eventId, e.getMessage(), e);
        }
    }

    /**
     * Pousse une mise a jour de disponibilite vers Agoda.
     */
    private void handleAvailabilityUpdate(Map<String, Object> data) {
        String propertyId = (String) data.get("property_id");
        String roomTypeId = (String) data.get("room_type_id");
        LocalDate date = parseDateField(data, "date");
        Boolean available = (Boolean) data.get("available");

        if (propertyId == null || date == null || available == null) {
            log.warn("Donnees manquantes pour la mise a jour de disponibilite Agoda");
            return;
        }

        BigDecimal price = parsePriceField(data, "price");
        String currency = (String) data.getOrDefault("currency", "EUR");
        int allotment = data.containsKey("allotment") ? ((Number) data.get("allotment")).intValue() : 1;

        AgodaAvailabilityDto dto = new AgodaAvailabilityDto(
                propertyId, roomTypeId, date, available, price, currency,
                allotment, 1, 30, false, false
        );

        agodaApiClient.updateAvailability(propertyId, List.of(dto));
        log.info("Disponibilite Agoda mise a jour pour propriete {} date {}", propertyId, date);
    }

    /**
     * Pousse une mise a jour de tarif vers Agoda.
     */
    private void handleRateUpdate(Map<String, Object> data) {
        String propertyId = (String) data.get("property_id");
        String roomTypeId = (String) data.get("room_type_id");
        LocalDate from = parseDateField(data, "from");
        LocalDate to = parseDateField(data, "to");
        BigDecimal rate = parsePriceField(data, "rate");
        String currency = (String) data.getOrDefault("currency", "EUR");

        if (propertyId == null || from == null || to == null || rate == null) {
            log.warn("Donnees manquantes pour la mise a jour de tarif Agoda");
            return;
        }

        agodaApiClient.updateRates(propertyId, roomTypeId, from, to, rate, currency);
        log.info("Tarif Agoda mis a jour pour propriete {} [{}, {})", propertyId, from, to);
    }

    private LocalDate parseDateField(Map<String, Object> data, String fieldName) {
        Object value = data.get(fieldName);
        if (value == null) return null;
        try {
            return LocalDate.parse(value.toString());
        } catch (DateTimeParseException e) {
            log.warn("Format de date invalide pour '{}': {}", fieldName, value);
            return null;
        }
    }

    private BigDecimal parsePriceField(Map<String, Object> data, String fieldName) {
        Object value = data.get(fieldName);
        if (value == null) return null;
        try {
            if (value instanceof Number number) {
                return BigDecimal.valueOf(number.doubleValue());
            }
            return new BigDecimal(value.toString());
        } catch (NumberFormatException e) {
            log.warn("Format de prix invalide pour '{}': {}", fieldName, value);
            return null;
        }
    }
}
