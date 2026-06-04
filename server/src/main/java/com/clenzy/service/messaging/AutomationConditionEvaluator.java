package com.clenzy.service.messaging;

import com.clenzy.model.Reservation;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.temporal.ChronoUnit;

/**
 * Evalue les conditions optionnelles d'une {@code AutomationRule} contre une reservation.
 *
 * Schema JSONB supporte (tous les champs sont optionnels, combines en ET logique) :
 * <pre>
 *   {
 *     "propertyIds":   [1, 2, 3],   // la propriete de la resa doit etre dans la liste
 *     "minNights":     2,           // nombre de nuits >= minNights
 *     "maxNights":     7,           // nombre de nuits <= maxNights
 *     "guestLanguage": "fr"         // langue du guest (insensible a la casse)
 *   }
 * </pre>
 *
 * Conventions :
 * - conditions absentes / vides ({@code null} ou blanc) => la regle s'applique toujours.
 * - JSON malforme => la regle est ignoree (fail-closed) pour eviter d'envoyer des
 *   messages mal cibles a partir d'une configuration corrompue.
 */
@Service
public class AutomationConditionEvaluator {

    private static final Logger log = LoggerFactory.getLogger(AutomationConditionEvaluator.class);

    private final ObjectMapper objectMapper;

    public AutomationConditionEvaluator(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * @return true si la reservation satisfait toutes les conditions presentes.
     */
    public boolean matches(String conditionsJson, Reservation reservation) {
        if (conditionsJson == null || conditionsJson.isBlank()) {
            return true;
        }

        JsonNode node;
        try {
            node = objectMapper.readTree(conditionsJson);
        } catch (Exception e) {
            log.warn("Conditions d'automatisation JSON invalides, regle ignoree: {}", e.getMessage());
            return false;
        }

        return matchesPropertyIds(node, reservation)
            && matchesNights(node, reservation)
            && matchesGuestLanguage(node, reservation);
    }

    private boolean matchesPropertyIds(JsonNode node, Reservation reservation) {
        JsonNode propertyIds = node.get("propertyIds");
        if (propertyIds == null || !propertyIds.isArray() || propertyIds.isEmpty()) {
            return true;
        }
        Long propertyId = reservation.getProperty() != null ? reservation.getProperty().getId() : null;
        if (propertyId == null) {
            return false;
        }
        for (JsonNode idNode : propertyIds) {
            if (idNode.isNumber() && idNode.asLong() == propertyId) {
                return true;
            }
        }
        return false;
    }

    private boolean matchesNights(JsonNode node, Reservation reservation) {
        JsonNode minNode = node.get("minNights");
        JsonNode maxNode = node.get("maxNights");
        boolean hasMin = minNode != null && minNode.isNumber();
        boolean hasMax = maxNode != null && maxNode.isNumber();
        if (!hasMin && !hasMax) {
            return true;
        }
        Long nights = computeNights(reservation);
        if (nights == null) {
            return false;
        }
        if (hasMin && nights < minNode.asInt()) {
            return false;
        }
        return !hasMax || nights <= maxNode.asInt();
    }

    private boolean matchesGuestLanguage(JsonNode node, Reservation reservation) {
        JsonNode langNode = node.get("guestLanguage");
        if (langNode == null || !langNode.isTextual() || langNode.asText().isBlank()) {
            return true;
        }
        String guestLanguage = reservation.getGuest() != null ? reservation.getGuest().getLanguage() : null;
        return guestLanguage != null && guestLanguage.equalsIgnoreCase(langNode.asText());
    }

    private Long computeNights(Reservation reservation) {
        if (reservation.getCheckIn() == null || reservation.getCheckOut() == null) {
            return null;
        }
        return ChronoUnit.DAYS.between(reservation.getCheckIn(), reservation.getCheckOut());
    }
}
