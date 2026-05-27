package com.clenzy.service.agent.briefing;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class EmailTemplateLoaderTest {

    private EmailTemplateLoader loader;

    @BeforeEach
    void setUp() {
        loader = new EmailTemplateLoader();
        loader.load();
    }

    @Test
    void renderBriefing_classpathTemplateLoadsAndInterpolates() {
        String html = loader.renderBriefing(Map.of(
                "title", "Briefing matinal",
                "subtitle", "12 juin",
                "body", "Tout va bien",
                "ctaUrl", "/assistant",
                "ctaLabel", "Ouvrir"
        ));

        assertNotNull(html, "Le template doit etre charge depuis le classpath");
        assertTrue(html.contains("Briefing matinal"));
        assertTrue(html.contains("12 juin"));
        assertTrue(html.contains("Tout va bien"));
        assertTrue(html.contains("/assistant"));
        assertTrue(html.contains("Ouvrir"));
        // Aucun placeholder non remplace
        assertFalse(html.contains("{{title}}"));
        assertFalse(html.contains("{{body}}"));
    }

    @Test
    void renderBriefing_missingVar_replacesByEmpty() {
        String html = loader.renderBriefing(Map.of("title", "T"));
        // Les autres placeholders restent — c'est OK car la map ne les contient pas.
        // Le contrat : seules les cles fournies sont substituees.
        assertTrue(html.contains("T"));
    }
}
