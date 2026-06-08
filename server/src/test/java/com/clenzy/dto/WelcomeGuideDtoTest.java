package com.clenzy.dto;

import com.clenzy.model.Property;
import com.clenzy.model.WelcomeGuide;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class WelcomeGuideDtoTest {

    @Test
    void canonicalConstructor_exposesAllAccessors() {
        LocalDateTime createdAt = LocalDateTime.of(2026, 5, 1, 10, 0);
        WelcomeGuideDto dto = new WelcomeGuideDto(
            1L, 42L, "Le Chalet", "fr", "Bienvenue", "[]", "[]", "[]",
            "#FF0000", "noir", "[7]", "Bienvenue chez nous", "Camille & Antoine",
            "https://cdn/logo.png", true, true, true, true, createdAt,
            true, null
        );

        assertEquals(1L, dto.id());
        assertEquals(42L, dto.propertyId());
        assertEquals("Le Chalet", dto.propertyName());
        assertEquals("fr", dto.language());
        assertEquals("Bienvenue", dto.title());
        assertEquals("[]", dto.sections());
        assertEquals("[]", dto.pois());
        assertEquals("[]", dto.curatedActivities());
        assertEquals("#FF0000", dto.brandingColor());
        assertEquals("noir", dto.theme());
        assertEquals("[7]", dto.heroPhotoIds());
        assertEquals("Bienvenue chez nous", dto.welcomeMessage());
        assertEquals("Camille & Antoine", dto.hostNames());
        assertEquals("https://cdn/logo.png", dto.logoUrl());
        assertTrue(dto.published());
        assertEquals(createdAt, dto.createdAt());
    }

    @Test
    void from_mapsAllFieldsWhenPropertyIsPresent() {
        Property property = new Property();
        property.setId(77L);
        property.setName("Appartement Marais");

        WelcomeGuide guide = new WelcomeGuide();
        guide.setId(5L);
        guide.setProperty(property);
        guide.setLanguage("en");
        guide.setTitle("Welcome");
        guide.setSections("[{\"title\":\"Wi-Fi\"}]");
        guide.setBrandingColor("#123456");
        guide.setTheme("jardin");
        guide.setHeroPhotoIds("[99]");
        guide.setWelcomeMessage("Bienvenue !");
        guide.setHostNames("Marie");
        guide.setLogoUrl("https://example.com/logo.svg");
        guide.setPublished(true);

        WelcomeGuideDto dto = WelcomeGuideDto.from(guide);

        assertEquals(5L, dto.id());
        assertEquals(77L, dto.propertyId());
        assertEquals("Appartement Marais", dto.propertyName());
        assertEquals("en", dto.language());
        assertEquals("Welcome", dto.title());
        assertEquals("[{\"title\":\"Wi-Fi\"}]", dto.sections());
        assertEquals("#123456", dto.brandingColor());
        assertEquals("jardin", dto.theme());
        assertEquals("[99]", dto.heroPhotoIds());
        assertEquals("Bienvenue !", dto.welcomeMessage());
        assertEquals("Marie", dto.hostNames());
        assertEquals("https://example.com/logo.svg", dto.logoUrl());
        assertTrue(dto.published());
    }

    @Test
    void from_nullProperty_returnsNullPropertyIdAndName() {
        WelcomeGuide guide = new WelcomeGuide();
        guide.setId(10L);
        guide.setTitle("Sans propriete");
        // language defaults to "fr"
        // property is null

        WelcomeGuideDto dto = WelcomeGuideDto.from(guide);

        assertEquals(10L, dto.id());
        assertNull(dto.propertyId());
        assertNull(dto.propertyName());
        assertEquals("fr", dto.language()); // entity default
        assertEquals("Sans propriete", dto.title());
        assertEquals("[]", dto.sections()); // entity default
        assertEquals("#2563EB", dto.brandingColor()); // entity default
        assertEquals("atelier", dto.theme()); // entity default
        assertEquals("[]", dto.heroPhotoIds()); // entity default
        assertNull(dto.logoUrl());
        assertFalse(dto.published()); // entity default
    }

    @Test
    void record_equalityByValue() {
        WelcomeGuideDto a = new WelcomeGuideDto(
            1L, 1L, "P", "fr", "T", "[]", "[]", "[]", "#000000", "atelier", null, null, null, null, false, false, false, false, null, false, null);
        WelcomeGuideDto b = new WelcomeGuideDto(
            1L, 1L, "P", "fr", "T", "[]", "[]", "[]", "#000000", "atelier", null, null, null, null, false, false, false, false, null, false, null);
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }
}
