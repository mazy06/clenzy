package com.clenzy.service;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class AiMessagingServiceTest {

    private final AiMessagingService service = new AiMessagingService();

    // ---- detectIntent ----

    @Test
    void detectIntent_checkIn() {
        assertEquals("CHECK_IN", service.detectIntent("Bonjour, a quelle heure est le check-in ?"));
    }

    @Test
    void detectIntent_checkOut() {
        assertEquals("CHECK_OUT", service.detectIntent("When do I need to checkout?"));
    }

    @Test
    void detectIntent_wifi() {
        assertEquals("WIFI", service.detectIntent("Quel est le mot de passe du wifi ?"));
    }

    @Test
    void detectIntent_parking() {
        assertEquals("PARKING", service.detectIntent("Ou est-ce que je peux garer ma voiture ?"));
    }

    @Test
    void detectIntent_problem() {
        assertEquals("PROBLEM", service.detectIntent("Il y a un probleme, le robinet est casse"));
    }

    @Test
    void detectIntent_amenities() {
        assertEquals("AMENITIES", service.detectIntent("A quelle heure ouvre la piscine ?"));
    }

    @Test
    void detectIntent_location() {
        assertEquals("LOCATION", service.detectIntent("Y a-t-il un supermarche ou une pharmacie a proximite ?"));
    }

    @Test
    void detectIntent_extension() {
        assertEquals("EXTENSION", service.detectIntent("Je voudrais prolonger mon sejour d'une nuit supplementaire"));
    }

    @Test
    void detectIntent_unknown() {
        assertEquals("UNKNOWN", service.detectIntent("Ceci est un message aleatoire sans intention"));
    }

    @Test
    void detectIntent_nullOrBlank() {
        assertEquals("UNKNOWN", service.detectIntent(null));
        assertEquals("UNKNOWN", service.detectIntent(""));
        assertEquals("UNKNOWN", service.detectIntent("   "));
    }

    // ---- generateSuggestedResponse ----

    @Test
    void suggestResponse_replacesVariables() {
        Map<String, String> vars = Map.of(
            "wifi_name", "ClenzyWifi",
            "wifi_password", "secret123"
        );
        String response = service.generateSuggestedResponse("Quel est le wifi password ?", vars);
        assertTrue(response.contains("ClenzyWifi"));
        assertTrue(response.contains("secret123"));
        assertFalse(response.contains("{wifi_name}"));
    }

    @Test
    void suggestResponse_unreplacedVarsShowPlaceholder() {
        String response = service.generateSuggestedResponse("check-in time?", Map.of());
        assertTrue(response.contains("[a configurer]"));
        assertFalse(response.contains("{check_in_time}"));
    }

    @Test
    void suggestResponse_unknownIntentDefaultMessage() {
        String response = service.generateSuggestedResponse("blabla random", Map.of());
        assertTrue(response.contains("Merci pour votre message"));
    }

    // ---- isUrgent ----

    @Test
    void isUrgent_detectsUrgentKeywords() {
        assertTrue(service.isUrgent("C'est urgent, il y a une fuite d'eau !"));
        assertTrue(service.isUrgent("There is a fire emergency"));
        assertTrue(service.isUrgent("I'm locked out of the apartment"));
        assertTrue(service.isUrgent("Il y a un danger"));
    }

    @Test
    void isUrgent_normalMessageNotUrgent() {
        assertFalse(service.isUrgent("Bonjour, a quelle heure est le check-in ?"));
        assertFalse(service.isUrgent("Merci pour tout, super sejour !"));
    }

    @Test
    void isUrgent_nullReturnsFalse() {
        assertFalse(service.isUrgent(null));
    }

    // ---- analyzeSentiment ----

    @Test
    void analyzeSentiment_positiveMessage() {
        double score = service.analyzeSentiment("Merci beaucoup, c'est super et parfait !");
        assertTrue(score > 0, "Positive message should have positive score");
    }

    @Test
    void analyzeSentiment_negativeMessage() {
        double score = service.analyzeSentiment("C'est terrible, l'appartement est sale et j'suis decu");
        assertTrue(score < 0, "Negative message should have negative score");
    }

    @Test
    void analyzeSentiment_neutralMessage() {
        double score = service.analyzeSentiment("Bonjour, a quelle heure est le checkout ?");
        assertEquals(0.0, score);
    }

    @Test
    void analyzeSentiment_nullOrBlank() {
        assertEquals(0.0, service.analyzeSentiment(null));
        assertEquals(0.0, service.analyzeSentiment(""));
        assertEquals(0.0, service.analyzeSentiment("   "));
    }

    @Test
    void analyzeSentiment_cappedAtOne() {
        // Even with many positive words, should not exceed 1.0
        double score = service.analyzeSentiment("merci thank great super excellent parfait perfect love amazing wonderful");
        assertTrue(score <= 1.0);
        assertTrue(score > 0);
    }
}
