package com.clenzy.service.messaging;

import com.clenzy.model.Reservation;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Map;

/**
 * Evalue les conditions optionnelles d'une {@code AutomationRule} contre le sujet
 * du declenchement : une reservation chargee, ou les donnees d'un sujet generique
 * (payload capteur — cles {@code propertyId}, {@code checkIn}/{@code checkOut} ISO,
 * {@code guestLanguage}).
 *
 * Schema JSONB supporte (tous les champs sont optionnels, combines en ET logique) :
 * <pre>
 *   {
 *     "propertyIds":   [1, 2, 3],   // la propriete du sujet doit etre dans la liste
 *     "minNights":     2,           // nombre de nuits >= minNights
 *     "maxNights":     7,           // nombre de nuits <= maxNights
 *     "guestLanguage": "fr",        // langue du guest (insensible a la casse)
 *
 *     // Conditions NUMERIQUES sur les data du sujet (F6b) — deux formes :
 *     //   nombre nu  = egalite ;  objet = bornes gte / lte / eq (combinees en ET).
 *     "alertsLast24h": { "gte": 3 },  // alertes bruit 24 h glissantes (sujet NOISE_ALERT)
 *     "daysOverdue":   { "gte": 7 }   // ou : "daysOverdue": 7 (egalite, sujet INVOICE)
 *   }
 * </pre>
 *
 * Conventions :
 * - conditions absentes / vides ({@code null} ou blanc) => la regle s'applique toujours.
 * - JSON malforme => la regle est ignoree (fail-closed) pour eviter d'envoyer des
 *   messages mal cibles a partir d'une configuration corrompue.
 * - condition presente mais fait indisponible sur le sujet (ex. minNights sur une
 *   facture) => fail-closed, la regle ne s'applique pas.
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
        return matchesFacts(conditionsJson, ConditionFacts.fromReservation(reservation));
    }

    /**
     * Variante sujet generique (fireTrigger sans reservation) : les faits sont extraits
     * des donnees du declenchement quand elles existent.
     *
     * @return true si les donnees du sujet satisfont toutes les conditions presentes.
     */
    public boolean matchesSubjectData(String conditionsJson, Map<String, Object> data) {
        return matchesFacts(conditionsJson, ConditionFacts.fromData(data));
    }

    private boolean matchesFacts(String conditionsJson, ConditionFacts facts) {
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

        return matchesPropertyIds(node, facts)
            && matchesNights(node, facts)
            && matchesGuestLanguage(node, facts)
            && matchesNumericFact(node, "alertsLast24h", facts.alertsLast24h())
            && matchesNumericFact(node, "daysOverdue", facts.daysOverdue());
    }

    private boolean matchesPropertyIds(JsonNode node, ConditionFacts facts) {
        JsonNode propertyIds = node.get("propertyIds");
        if (propertyIds == null || !propertyIds.isArray() || propertyIds.isEmpty()) {
            return true;
        }
        if (facts.propertyId() == null) {
            return false;
        }
        for (JsonNode idNode : propertyIds) {
            if (idNode.isNumber() && idNode.asLong() == facts.propertyId()) {
                return true;
            }
        }
        return false;
    }

    private boolean matchesNights(JsonNode node, ConditionFacts facts) {
        JsonNode minNode = node.get("minNights");
        JsonNode maxNode = node.get("maxNights");
        boolean hasMin = minNode != null && minNode.isNumber();
        boolean hasMax = maxNode != null && maxNode.isNumber();
        if (!hasMin && !hasMax) {
            return true;
        }
        Long nights = facts.nights();
        if (nights == null) {
            return false;
        }
        if (hasMin && nights < minNode.asInt()) {
            return false;
        }
        return !hasMax || nights <= maxNode.asInt();
    }

    /**
     * Condition numerique generique sur une donnee du sujet (F6b). Deux formes,
     * retro-compatibles (champ absent = pas de contrainte, comme le reste du schema) :
     * nombre nu = egalite ; objet {@code {gte, lte, eq}} = bornes combinees en ET.
     * Fait indisponible sur le sujet alors que la condition est presente → fail-closed.
     */
    private boolean matchesNumericFact(JsonNode node, String field, Long fact) {
        JsonNode cond = node.get(field);
        if (cond == null || cond.isNull()) {
            return true;
        }
        Long gte = null;
        Long lte = null;
        Long eq = null;
        if (cond.isNumber()) {
            eq = cond.asLong();
        } else if (cond.isObject()) {
            gte = numberOrNull(cond.get("gte"));
            lte = numberOrNull(cond.get("lte"));
            eq = numberOrNull(cond.get("eq"));
            if (gte == null && lte == null && eq == null) {
                return true; // objet sans borne exploitable = pas de contrainte (retro-compat)
            }
        } else {
            return true; // type inattendu, ignore (meme convention que guestLanguage/minNights)
        }
        if (fact == null) {
            return false; // fail-closed : condition presente, fait indisponible sur ce sujet
        }
        if (eq != null && !fact.equals(eq)) {
            return false;
        }
        if (gte != null && fact < gte) {
            return false;
        }
        return lte == null || fact <= lte;
    }

    private static Long numberOrNull(JsonNode node) {
        return node != null && node.isNumber() ? node.asLong() : null;
    }

    private boolean matchesGuestLanguage(JsonNode node, ConditionFacts facts) {
        JsonNode langNode = node.get("guestLanguage");
        if (langNode == null || !langNode.isTextual() || langNode.asText().isBlank()) {
            return true;
        }
        return facts.guestLanguage() != null
            && facts.guestLanguage().equalsIgnoreCase(langNode.asText());
    }

    /**
     * Faits evaluables, extraits d'une reservation ou des donnees d'un sujet generique.
     * Les faits numeriques ({@code alertsLast24h}, {@code daysOverdue}) n'existent que
     * sur les sujets capteur (data du declenchement) — null sur une reservation, donc
     * fail-closed si une regle reservation porte une telle condition.
     */
    private record ConditionFacts(Long propertyId, Long nights, String guestLanguage,
                                  Long alertsLast24h, Long daysOverdue) {

        static ConditionFacts fromReservation(Reservation reservation) {
            if (reservation == null) {
                return new ConditionFacts(null, null, null, null, null);
            }
            Long propertyId = reservation.getProperty() != null ? reservation.getProperty().getId() : null;
            Long nights = (reservation.getCheckIn() != null && reservation.getCheckOut() != null)
                ? ChronoUnit.DAYS.between(reservation.getCheckIn(), reservation.getCheckOut()) : null;
            String guestLanguage = reservation.getGuest() != null ? reservation.getGuest().getLanguage() : null;
            return new ConditionFacts(propertyId, nights, guestLanguage, null, null);
        }

        static ConditionFacts fromData(Map<String, Object> data) {
            if (data == null || data.isEmpty()) {
                return new ConditionFacts(null, null, null, null, null);
            }
            Long propertyId = asLong(data.get("propertyId"));
            LocalDate checkIn = asDate(data.get("checkIn"));
            LocalDate checkOut = asDate(data.get("checkOut"));
            Long nights = (checkIn != null && checkOut != null)
                ? ChronoUnit.DAYS.between(checkIn, checkOut) : null;
            Object language = data.get("guestLanguage");
            return new ConditionFacts(propertyId, nights,
                language != null ? language.toString() : null,
                asLong(data.get("alertsLast24h")), asLong(data.get("daysOverdue")));
        }

        private static Long asLong(Object value) {
            if (value instanceof Number number) {
                return number.longValue();
            }
            if (value instanceof String s && !s.isBlank()) {
                try {
                    return Long.parseLong(s.trim());
                } catch (NumberFormatException e) {
                    return null;
                }
            }
            return null;
        }

        private static LocalDate asDate(Object value) {
            if (value == null) {
                return null;
            }
            try {
                return LocalDate.parse(value.toString().trim());
            } catch (Exception e) {
                return null;
            }
        }
    }
}
