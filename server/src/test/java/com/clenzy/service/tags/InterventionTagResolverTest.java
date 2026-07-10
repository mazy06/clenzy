package com.clenzy.service.tags;

import com.clenzy.model.Intervention;
import com.clenzy.model.Property;
import com.clenzy.repository.CheckInInstructionsRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.service.pricing.CleaningPricingEngine;
import com.clenzy.service.pricing.CleaningPricingEngine.CleaningInputs;
import com.clenzy.service.pricing.CleaningPricingEngine.CleaningQuote;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tags moteur menage du resolveur intervention (P1, PLAN-MOTEUR-MENAGE.md) :
 * ${intervention.prix_conseil}, ${intervention.fourchette},
 * ${intervention.duree_normee}, ${intervention.decomposition}.
 */
@ExtendWith(MockitoExtension.class)
class InterventionTagResolverTest {

    @Mock private InterventionRepository interventionRepository;
    @Mock private CheckInInstructionsRepository checkInInstructionsRepository;
    @Mock private CleaningPricingEngine cleaningPricingEngine;

    private InterventionTagResolver resolver;

    @BeforeEach
    void setUp() {
        EntityTagBuilders builders = new EntityTagBuilders(checkInInstructionsRepository, new ObjectMapper());
        resolver = new InterventionTagResolver(interventionRepository, builders, cleaningPricingEngine);
    }

    private Property property() {
        Property property = new Property();
        property.setId(10L);
        property.setName("Duplex Marrakech");
        property.setBedroomCount(2);
        property.setBathroomCount(1);
        return property;
    }

    private Intervention intervention(Property property, BigDecimal recommendedCost) {
        Intervention intervention = new Intervention();
        intervention.setId(100L);
        intervention.setType("CLEANING");
        intervention.setProperty(property);
        intervention.setRecommendedCost(recommendedCost);
        return intervention;
    }

    /** Quote calibree Marrakech : 135 min, 95 € conseil, fourchette 80-110. */
    private void stubEngineQuote() {
        when(cleaningPricingEngine.quote(any(Property.class), anyString()))
                .thenReturn(new CleaningQuote(135,
                        BigDecimal.valueOf(95), BigDecimal.valueOf(80), BigDecimal.valueOf(110)));
        Map<String, Integer> breakdown = new LinkedHashMap<>();
        breakdown.put("base", 120);
        breakdown.put("bathrooms", 0);
        breakdown.put("surface", 0);
        breakdown.put("floors", 15);
        breakdown.put("exterior", 0);
        breakdown.put("laundry", 0);
        breakdown.put("guests", 0);
        when(cleaningPricingEngine.minutesBreakdown(any(CleaningInputs.class))).thenReturn(breakdown);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> resolveInterventionTags() {
        Map<String, Object> context = new HashMap<>();
        resolver.resolve(100L, context);
        return (Map<String, Object>) context.get("intervention");
    }

    @Nested
    @DisplayName("tags moteur menage")
    class CleaningEngineTags {

        @Test
        void whenRecommendedCostSnapshotted_thenPrixConseilUsesSnapshotNotLiveQuote() {
            stubEngineQuote();
            Intervention intervention = intervention(property(), BigDecimal.valueOf(88.50));
            when(interventionRepository.findById(100L)).thenReturn(Optional.of(intervention));

            Map<String, Object> tags = resolveInterventionTags();

            // Snapshot 88,50 € prioritaire sur la quote live (95 €).
            // (formatMoney est dependant de la locale JVM : on compare via le meme formatteur.)
            assertThat(tags.get("prix_conseil"))
                    .isEqualTo(TagFormatting.formatMoney(BigDecimal.valueOf(88.50)));
            assertThat(tags.get("fourchette"))
                    .isEqualTo(TagFormatting.formatMoney(BigDecimal.valueOf(80))
                            + " – " + TagFormatting.formatMoney(BigDecimal.valueOf(110)));
            assertThat(tags.get("duree_normee")).isEqualTo("2 h 15");
            assertThat(tags.get("decomposition"))
                    .isEqualTo("Base (2 ch) : 120 min · Niveau supp. : 15 min");
        }

        @Test
        void whenNoRecommendedCost_thenPrixConseilFallsBackToLiveQuote() {
            stubEngineQuote();
            Intervention intervention = intervention(property(), null);
            when(interventionRepository.findById(100L)).thenReturn(Optional.of(intervention));

            Map<String, Object> tags = resolveInterventionTags();

            assertThat(tags.get("prix_conseil"))
                    .isEqualTo(TagFormatting.formatMoney(BigDecimal.valueOf(95)));
        }

        @Test
        void whenNoProperty_thenEngineTagsEmptyButSnapshotKept() {
            Intervention intervention = intervention(null, BigDecimal.valueOf(75));
            when(interventionRepository.findById(100L)).thenReturn(Optional.of(intervention));

            Map<String, Object> tags = resolveInterventionTags();

            assertThat(tags.get("prix_conseil"))
                    .isEqualTo(TagFormatting.formatMoney(BigDecimal.valueOf(75)));
            assertThat(tags.get("fourchette")).isEqualTo("");
            assertThat(tags.get("duree_normee")).isEqualTo("");
            assertThat(tags.get("decomposition")).isEqualTo("");
            verify(cleaningPricingEngine, never()).quote(any(Property.class), anyString());
        }

        @Test
        void whenNoPropertyAndNoSnapshot_thenAllEngineTagsEmpty() {
            Intervention intervention = intervention(null, null);
            when(interventionRepository.findById(100L)).thenReturn(Optional.of(intervention));

            Map<String, Object> tags = resolveInterventionTags();

            assertThat(tags.get("prix_conseil")).isEqualTo("");
            assertThat(tags.get("fourchette")).isEqualTo("");
            assertThat(tags.get("duree_normee")).isEqualTo("");
            assertThat(tags.get("decomposition")).isEqualTo("");
        }

        @Test
        void whenEngineThrows_thenTagsEmptyAndNoException() {
            // Un tag qui casse la generation de PDF est interdit : l'erreur moteur
            // doit etre avalee et produire des chaines vides.
            when(cleaningPricingEngine.quote(any(Property.class), anyString()))
                    .thenThrow(new IllegalStateException("config KO"));
            Intervention intervention = intervention(property(), null);
            when(interventionRepository.findById(100L)).thenReturn(Optional.of(intervention));

            Map<String, Object> context = new HashMap<>();
            assertThatCode(() -> resolver.resolve(100L, context)).doesNotThrowAnyException();

            @SuppressWarnings("unchecked")
            Map<String, Object> tags = (Map<String, Object>) context.get("intervention");
            assertThat(tags.get("prix_conseil")).isEqualTo("");
            assertThat(tags.get("fourchette")).isEqualTo("");
            assertThat(tags.get("duree_normee")).isEqualTo("");
            assertThat(tags.get("decomposition")).isEqualTo("");
        }

        @Test
        void whenInterventionTypeSet_thenPassedToEngineAsCleaningType() {
            stubEngineQuote();
            Intervention intervention = intervention(property(), null);
            intervention.setType("DEEP_CLEANING");
            when(interventionRepository.findById(100L)).thenReturn(Optional.of(intervention));

            resolveInterventionTags();

            verify(cleaningPricingEngine).quote(any(Property.class), eq("DEEP_CLEANING"));
        }
    }

    @Nested
    @DisplayName("formats")
    class Formats {

        @Test
        void formatEngineDuration_coversHoursAndMinutes() {
            assertThat(InterventionTagResolver.formatEngineDuration(45)).isEqualTo("45 min");
            assertThat(InterventionTagResolver.formatEngineDuration(120)).isEqualTo("2 h");
            assertThat(InterventionTagResolver.formatEngineDuration(135)).isEqualTo("2 h 15");
            assertThat(InterventionTagResolver.formatEngineDuration(65)).isEqualTo("1 h 05");
        }

        @Test
        void formatBreakdown_skipsZeroComponentsAndLabelsInFrench() {
            Map<String, Integer> breakdown = new LinkedHashMap<>();
            breakdown.put("base", 120);
            breakdown.put("bathrooms", 15);
            breakdown.put("surface", 0);
            breakdown.put("laundry", 15);

            assertThat(InterventionTagResolver.formatBreakdown(breakdown, 2))
                    .isEqualTo("Base (2 ch) : 120 min · Salle de bain supp. : 15 min · Linge : 15 min");
        }

        @Test
        void formatBreakdown_withoutBedrooms_usesPlainBaseLabel() {
            Map<String, Integer> breakdown = new LinkedHashMap<>();
            breakdown.put("base", 90);

            assertThat(InterventionTagResolver.formatBreakdown(breakdown, null))
                    .isEqualTo("Base : 90 min");
        }
    }
}
