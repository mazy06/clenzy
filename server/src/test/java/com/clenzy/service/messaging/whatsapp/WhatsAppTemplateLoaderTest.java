package com.clenzy.service.messaging.whatsapp;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WhatsAppTemplateLoaderTest {

    private WhatsAppTemplateLoader loader;

    @BeforeEach
    void setUp() {
        loader = new WhatsAppTemplateLoader();
        loader.load();
    }

    @Test
    void load_chargesLes5TemplatesStandards() {
        // Verifie qu'on a bien les 5 templates Clenzy de base, dans les 3 langues.
        // Toute modification (ajout/retrait) d'un YAML doit etre intentionnelle.
        assertThat(loader.getAllTemplates()).hasSize(5);

        // Verifie les cles attendues
        assertThat(loader.getAllTemplates())
            .extracting(WhatsAppTemplateDefinition::key)
            .containsExactlyInAnyOrder(
                "booking_confirmation",
                "checkin_instructions",
                "arrival_code",
                "checkout_reminder",
                "review_request"
            );

        // Tous les templates doivent etre UTILITY (pas MARKETING en v1)
        assertThat(loader.getAllTemplates())
            .allSatisfy(t -> assertThat(t.category()).isEqualTo("UTILITY"));

        // Tous les templates doivent avoir les 3 langues FR/EN/AR
        assertThat(loader.getAllTemplates())
            .allSatisfy(t -> assertThat(t.languages()).containsKeys("fr_FR", "en_US", "ar_AR"));
    }

    @Test
    void metaTemplateName_prefixedAndVersioned() {
        // Le nom Meta doit etre prefixe `clenzy_` et suffixe `_v1` pour
        // permettre les bumps de version sans casser les hosts existants.
        WhatsAppTemplateDefinition booking = loader.getAllTemplates().stream()
            .filter(t -> "booking_confirmation".equals(t.key()))
            .findFirst()
            .orElseThrow();

        assertThat(booking.metaTemplateName()).isEqualTo("clenzy_booking_confirmation_v1");
    }

    @Test
    void load_bodyContientPlaceholdersMeta() {
        // Verifie que les bodies des templates utilisent bien les placeholders
        // Meta {{1}}, {{2}}, etc. — sinon Meta refuse la submission.
        WhatsAppTemplateDefinition booking = loader.getAllTemplates().stream()
            .filter(t -> "booking_confirmation".equals(t.key()))
            .findFirst()
            .orElseThrow();

        String frBody = booking.languages().get("fr_FR").body();
        assertThat(frBody).contains("{{1}}", "{{2}}", "{{3}}", "{{4}}");
    }
}
