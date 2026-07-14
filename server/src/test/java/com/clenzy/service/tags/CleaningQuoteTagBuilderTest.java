package com.clenzy.service.tags;

import com.clenzy.model.Property;
import com.clenzy.repository.HousekeeperRateRepository;
import com.clenzy.service.PricingConfigService;
import com.clenzy.service.pricing.CleaningPricingEngine;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Moteur Ménage 3A (P8) — tags ${menage.*} du devis ménage interne.
 * Vrai moteur (défauts plateforme) : profil Marrakech → valeurs attendues ;
 * contrat « jamais de tag manquant » (toutes les clés posées, repli vide).
 */
@ExtendWith(MockitoExtension.class)
class CleaningQuoteTagBuilderTest {

    @Mock private PricingConfigService pricingConfigService;
    @Mock private HousekeeperRateRepository housekeeperRateRepository;

    private CleaningQuoteTagBuilder builder() {
        return new CleaningQuoteTagBuilder(
                new CleaningPricingEngine(pricingConfigService, new ObjectMapper(), housekeeperRateRepository));
    }

    private static final String[] ALL_KEYS = {
            "express_prix", "express_fourchette", "express_duree",
            "standard_prix", "standard_fourchette", "standard_duree",
            "deep_prix", "deep_fourchette", "deep_duree",
            "decomposition", "taux_horaire"};

    @Test
    @DisplayName("profil Marrakech (2ch/1sdb/50m²/2 niveaux) → tags remplis, standard 95 €")
    void whenTypicalProfile_thenTagsFilled() {
        when(pricingConfigService.getCleaningEngineConfigJson()).thenReturn(null);
        Property property = new Property();
        property.setId(3L);
        property.setBedroomCount(2);
        property.setBathroomCount(1);
        property.setSquareMeters(50);
        property.setNumberOfFloors(2);
        property.setMaxGuests(4);
        // L'entité Property initialise hasLaundry=true par défaut — le profil de
        // calibration Marrakech est SANS buanderie/extérieur : on l'explicite.
        property.setHasLaundry(false);
        property.setHasExterior(false);

        Map<String, Object> tags = builder().menageTags(property);

        assertThat(tags.keySet()).contains(ALL_KEYS);
        assertThat(tags.get("standard_prix")).isEqualTo("95 €");
        assertThat(tags.get("standard_fourchette")).isEqualTo("80 € – 110 €");
        assertThat(tags.get("standard_duree")).isEqualTo("2 h 15");
        assertThat(tags.get("express_prix")).isEqualTo("60 €");
        assertThat(tags.get("deep_prix")).isEqualTo("150 €");
        assertThat((String) tags.get("decomposition"))
                .contains("Base (chambres) : 120 min")
                .contains("Étages supplémentaires : 15 min");
        assertThat(tags.get("taux_horaire")).isEqualTo("42 €/h");
    }

    @Test
    @DisplayName("moteur en échec → toutes les clés posées, valeurs vides (génération jamais cassée)")
    void whenEngineFails_thenAllKeysPresentEmpty() {
        when(pricingConfigService.getCleaningEngineConfigJson())
                .thenThrow(new RuntimeException("config down"));
        Property property = new Property();
        property.setId(3L);

        Map<String, Object> tags = builder().menageTags(property);

        assertThat(tags.keySet()).contains(ALL_KEYS);
        for (String key : ALL_KEYS) {
            assertThat(tags.get(key)).as(key).isEqualTo("");
        }
    }
}
