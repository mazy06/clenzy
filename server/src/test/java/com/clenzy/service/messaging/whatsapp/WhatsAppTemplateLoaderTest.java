package com.clenzy.service.messaging.whatsapp;

import com.clenzy.model.WhatsAppTemplateContent;
import com.clenzy.repository.WhatsAppTemplateContentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class WhatsAppTemplateLoaderTest {

    private WhatsAppTemplateLoader loader;

    @BeforeEach
    void setUp() {
        loader = new WhatsAppTemplateLoader();
        loader.load();
    }

    @Test
    void load_chargesLes6TemplatesStandards() {
        // Verifie qu'on a bien les 6 templates Clenzy de base, dans les 3 langues.
        // Toute modification (ajout/retrait) d'un YAML doit etre intentionnelle.
        assertThat(loader.getAllTemplates()).hasSize(6);

        // Verifie les cles attendues
        assertThat(loader.getAllTemplates())
            .extracting(WhatsAppTemplateDefinition::key)
            .containsExactlyInAnyOrder(
                "booking_confirmation",
                "checkin_instructions",
                "arrival_code",
                "checkout_reminder",
                "review_request",
                "noise_alert"
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

    // ─── BDD (database) source tests ───────────────────────────────────────

    @Test
    void load_fromDb_returnsTemplatesGroupedByKey() {
        WhatsAppTemplateContentRepository repo = mock(WhatsAppTemplateContentRepository.class);
        WhatsAppVariableConverter converter = mock(WhatsAppVariableConverter.class);

        WhatsAppTemplateContent fr = newRow("booking_confirmation", "fr_FR", "UTILITY",
                "Bonjour {guestFirstName}");
        WhatsAppTemplateContent en = newRow("booking_confirmation", "en_US", "UTILITY",
                "Hello {guestFirstName}");
        WhatsAppTemplateContent other = newRow("review_request", "fr_FR", "UTILITY",
                "Notez {propertyName}");
        when(repo.findAllSystemTemplates()).thenReturn(List.of(fr, en, other));
        when(converter.toPositional(anyString())).thenAnswer(inv -> {
            String body = inv.getArgument(0);
            return new WhatsAppVariableConverter.ConversionResult(
                    body.replaceAll("\\{[^}]+}", "{{1}}"), List.of("x"));
        });

        WhatsAppTemplateLoader dbLoader = new WhatsAppTemplateLoader(repo, converter);
        dbLoader.load();

        assertThat(dbLoader.getAllTemplates()).hasSize(2);
        assertThat(dbLoader.getAllTemplates())
                .extracting(WhatsAppTemplateDefinition::key)
                .containsExactlyInAnyOrder("booking_confirmation", "review_request");

        WhatsAppTemplateDefinition booking = dbLoader.getAllTemplates().stream()
                .filter(t -> "booking_confirmation".equals(t.key())).findFirst().orElseThrow();
        assertThat(booking.languages()).containsKeys("fr_FR", "en_US");
    }

    @Test
    void load_fromDb_whenConverterThrows_skipsThatLanguage() {
        WhatsAppTemplateContentRepository repo = mock(WhatsAppTemplateContentRepository.class);
        WhatsAppVariableConverter converter = mock(WhatsAppVariableConverter.class);

        WhatsAppTemplateContent fr = newRow("k1", "fr_FR", "UTILITY", "Bad{");
        WhatsAppTemplateContent en = newRow("k1", "en_US", "UTILITY", "OK");
        when(repo.findAllSystemTemplates()).thenReturn(List.of(fr, en));
        when(converter.toPositional("Bad{")).thenThrow(new RuntimeException("parse fail"));
        when(converter.toPositional("OK")).thenReturn(
                new WhatsAppVariableConverter.ConversionResult("OK", List.of()));

        WhatsAppTemplateLoader dbLoader = new WhatsAppTemplateLoader(repo, converter);
        dbLoader.load();

        assertThat(dbLoader.getAllTemplates()).hasSize(1);
        assertThat(dbLoader.getAllTemplates().get(0).languages()).containsOnlyKeys("en_US");
    }

    @Test
    void load_fromDb_whenEmpty_fallsBackToYaml() {
        WhatsAppTemplateContentRepository repo = mock(WhatsAppTemplateContentRepository.class);
        WhatsAppVariableConverter converter = mock(WhatsAppVariableConverter.class);
        when(repo.findAllSystemTemplates()).thenReturn(List.of());

        WhatsAppTemplateLoader dbLoader = new WhatsAppTemplateLoader(repo, converter);
        dbLoader.load();

        // Falls back to YAML — same 6 standard templates
        assertThat(dbLoader.getAllTemplates()).hasSize(6);
    }

    @Test
    void load_whenRepoThrows_fallsBackToYaml() {
        WhatsAppTemplateContentRepository repo = mock(WhatsAppTemplateContentRepository.class);
        WhatsAppVariableConverter converter = mock(WhatsAppVariableConverter.class);
        when(repo.findAllSystemTemplates()).thenThrow(new RuntimeException("db down"));

        WhatsAppTemplateLoader dbLoader = new WhatsAppTemplateLoader(repo, converter);
        dbLoader.load();

        assertThat(dbLoader.getAllTemplates()).hasSize(6);
    }

    @Test
    void reloadFromDatabase_withDependencies_updatesTemplates() {
        WhatsAppTemplateContentRepository repo = mock(WhatsAppTemplateContentRepository.class);
        WhatsAppVariableConverter converter = mock(WhatsAppVariableConverter.class);

        // Initial load with one row
        WhatsAppTemplateContent init = newRow("alpha", "fr_FR", "UTILITY", "Salut");
        when(repo.findAllSystemTemplates()).thenReturn(List.of(init));
        when(converter.toPositional(anyString())).thenReturn(
                new WhatsAppVariableConverter.ConversionResult("Salut", List.of()));

        WhatsAppTemplateLoader dbLoader = new WhatsAppTemplateLoader(repo, converter);
        dbLoader.load();
        assertThat(dbLoader.getAllTemplates()).hasSize(1);

        // Now return 2 rows
        WhatsAppTemplateContent again = newRow("beta", "en_US", "UTILITY", "Hi");
        when(repo.findAllSystemTemplates()).thenReturn(List.of(init, again));

        dbLoader.reloadFromDatabase();

        assertThat(dbLoader.getAllTemplates()).hasSize(2);
    }

    @Test
    void reloadFromDatabase_withoutDependencies_isNoOp() {
        WhatsAppTemplateLoader yamlOnly = new WhatsAppTemplateLoader();
        yamlOnly.load();
        int countBefore = yamlOnly.getAllTemplates().size();

        yamlOnly.reloadFromDatabase();

        assertThat(yamlOnly.getAllTemplates()).hasSize(countBefore);
    }

    @Test
    void reloadFromDatabase_whenErrorOccurs_keepsOldCache() {
        WhatsAppTemplateContentRepository repo = mock(WhatsAppTemplateContentRepository.class);
        WhatsAppVariableConverter converter = mock(WhatsAppVariableConverter.class);

        WhatsAppTemplateContent init = newRow("alpha", "fr_FR", "UTILITY", "Salut");
        when(repo.findAllSystemTemplates()).thenReturn(List.of(init));
        when(converter.toPositional(anyString())).thenReturn(
                new WhatsAppVariableConverter.ConversionResult("Salut", List.of()));

        WhatsAppTemplateLoader dbLoader = new WhatsAppTemplateLoader(repo, converter);
        dbLoader.load();
        int before = dbLoader.getAllTemplates().size();

        when(repo.findAllSystemTemplates()).thenThrow(new RuntimeException("db down"));
        dbLoader.reloadFromDatabase();

        assertThat(dbLoader.getAllTemplates()).hasSize(before);
    }

    @Test
    void getAllTemplates_isImmutable() {
        org.junit.jupiter.api.Assertions.assertThrows(UnsupportedOperationException.class,
                () -> loader.getAllTemplates().clear());
    }

    private static WhatsAppTemplateContent newRow(String key, String lang, String category, String body) {
        WhatsAppTemplateContent c = new WhatsAppTemplateContent();
        c.setTemplateKey(key);
        c.setLanguage(lang);
        c.setCategory(category);
        c.setBodyNamed(body);
        return c;
    }
}
