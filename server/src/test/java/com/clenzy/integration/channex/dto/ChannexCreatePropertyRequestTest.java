package com.clenzy.integration.channex.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * B3 — le payload de creation porte des la creation l'adresse/contact/geo
 * (REQUIS par Channex a la connexion du 1er channel), property_type
 * (facturation VR) et les settings (PMS maitre de l'availability).
 */
@DisplayName("ChannexCreatePropertyRequest")
class ChannexCreatePropertyRequestTest {

    @Test
    @DisplayName("payload complet : adresse/contact/geo + property_type + settings")
    void fullPayload() {
        Map<String, Object> settings = Map.of(
            "allow_availability_autoupdate_on_modification", false,
            "state_length", 500);
        var request = new ChannexCreatePropertyRequest(
            "Duplex Marrakech", "EUR", "MA", "Africa/Casablanca", "grp-1",
            "host@example.com", "+212600000000", "40000", "Marrakech", "12 rue Exemple",
            new BigDecimal("31.6295"), new BigDecimal("-7.9811"),
            "apartment", settings);

        @SuppressWarnings("unchecked")
        Map<String, Object> property = (Map<String, Object>) request.toApiPayload().get("property");

        assertThat(property)
            .containsEntry("title", "Duplex Marrakech")
            .containsEntry("currency", "EUR")
            .containsEntry("country", "MA")
            .containsEntry("timezone", "Africa/Casablanca")
            .containsEntry("group_id", "grp-1")
            .containsEntry("email", "host@example.com")
            .containsEntry("phone", "+212600000000")
            .containsEntry("zip_code", "40000")
            .containsEntry("city", "Marrakech")
            .containsEntry("address", "12 rue Exemple")
            .containsEntry("latitude", "31.6295")
            .containsEntry("longitude", "-7.9811")
            .containsEntry("property_type", "apartment");
        assertThat(property.get("settings")).isEqualTo(settings);
    }

    @Test
    @DisplayName("champs optionnels vides/null -> omis du payload (pas de chaines vides)")
    void omitsEmptyOptionals() {
        var request = new ChannexCreatePropertyRequest(
            "Studio", "EUR", "FR", "Europe/Paris", null);

        @SuppressWarnings("unchecked")
        Map<String, Object> property = (Map<String, Object>) request.toApiPayload().get("property");

        assertThat(property)
            .containsOnlyKeys("title", "currency", "country", "timezone");
    }
}
