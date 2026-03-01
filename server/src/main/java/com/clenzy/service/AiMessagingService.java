package com.clenzy.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class AiMessagingService {

    private static final Logger log = LoggerFactory.getLogger(AiMessagingService.class);

    private static final Map<String, List<String>> INTENT_KEYWORDS = Map.of(
        "CHECK_IN", List.of("check-in", "checkin", "arrive", "arrivee", "entree", "cle", "key", "code"),
        "CHECK_OUT", List.of("check-out", "checkout", "depart", "leave", "quitter"),
        "WIFI", List.of("wifi", "internet", "connexion", "password", "mot de passe"),
        "PARKING", List.of("parking", "garer", "voiture", "car", "stationnement"),
        "PROBLEM", List.of("probleme", "problem", "broken", "casse", "panne", "fuite", "leak", "noise", "bruit"),
        "AMENITIES", List.of("piscine", "pool", "gym", "spa", "sauna", "bbq", "barbecue"),
        "LOCATION", List.of("restaurant", "supermarche", "pharmacy", "pharmacie", "hospital", "metro", "bus"),
        "EXTENSION", List.of("prolonger", "extend", "extra night", "nuit supplementaire", "rester")
    );

    private static final Map<String, String> RESPONSE_TEMPLATES = Map.of(
        "CHECK_IN", "Bonjour ! Le check-in est a partir de {check_in_time}. Vous trouverez les cles {key_location}. Le code d'acces est {access_code}. N'hesitez pas si vous avez des questions !",
        "CHECK_OUT", "Le check-out est avant {check_out_time}. Merci de laisser les cles {key_location}. Nous esperons que vous avez passe un excellent sejour !",
        "WIFI", "Le reseau WiFi est : {wifi_name} / Mot de passe : {wifi_password}. Si vous rencontrez des problemes de connexion, essayez de redemarrer le routeur.",
        "PARKING", "Le parking se trouve {parking_info}. Votre place est {parking_spot}.",
        "PROBLEM", "Nous sommes desoles pour ce desagrement. Nous allons traiter votre demande rapidement. Pouvez-vous nous donner plus de details sur le probleme ?",
        "AMENITIES", "Voici les informations sur les equipements : {amenities_info}. Les horaires sont {amenities_hours}.",
        "LOCATION", "Voici quelques adresses utiles a proximite : {nearby_info}.",
        "EXTENSION", "Merci pour votre interet a prolonger votre sejour ! Nous verifions la disponibilite et revenons vers vous rapidement."
    );

    /**
     * Detecte l'intention du message du guest.
     */
    public String detectIntent(String message) {
        if (message == null || message.isBlank()) return "UNKNOWN";

        String lower = message.toLowerCase();

        String bestIntent = "UNKNOWN";
        int bestScore = 0;

        for (Map.Entry<String, List<String>> entry : INTENT_KEYWORDS.entrySet()) {
            int score = 0;
            for (String keyword : entry.getValue()) {
                if (lower.contains(keyword)) {
                    score++;
                }
            }
            if (score > bestScore) {
                bestScore = score;
                bestIntent = entry.getKey();
            }
        }

        return bestIntent;
    }

    /**
     * Genere une reponse suggeree basee sur l'intention detectee.
     */
    public String generateSuggestedResponse(String message, Map<String, String> propertyVars) {
        String intent = detectIntent(message);
        String template = RESPONSE_TEMPLATES.getOrDefault(intent,
            "Merci pour votre message. Nous avons bien recu votre demande et nous y repondrons dans les plus brefs delais.");

        // Replace variables
        for (Map.Entry<String, String> var : propertyVars.entrySet()) {
            template = template.replace("{" + var.getKey() + "}", var.getValue());
        }

        // Remove unreplaced variables
        template = template.replaceAll("\\{[^}]+\\}", "[a configurer]");

        return template;
    }

    /**
     * Evalue si un message est urgent.
     */
    public boolean isUrgent(String message) {
        if (message == null) return false;
        String lower = message.toLowerCase();
        return lower.contains("urgent") || lower.contains("emergency") || lower.contains("urgence")
            || lower.contains("danger") || lower.contains("fuite") || lower.contains("leak")
            || lower.contains("flood") || lower.contains("fire") || lower.contains("feu")
            || lower.contains("locked out") || lower.contains("enferme");
    }

    /**
     * Score de sentiment du message (-1 negatif, 0 neutre, 1 positif).
     */
    public double analyzeSentiment(String message) {
        if (message == null || message.isBlank()) return 0;
        String lower = message.toLowerCase();

        int positive = 0;
        int negative = 0;

        for (String word : List.of("merci", "thank", "great", "super", "excellent", "parfait", "perfect", "love", "amazing", "wonderful")) {
            if (lower.contains(word)) positive++;
        }
        for (String word : List.of("probleme", "problem", "bad", "terrible", "horrible", "dirty", "sale", "broken", "decu", "disappointed")) {
            if (lower.contains(word)) negative++;
        }

        if (positive > negative) return Math.min(1.0, positive * 0.3);
        if (negative > positive) return -Math.min(1.0, negative * 0.3);
        return 0;
    }
}
