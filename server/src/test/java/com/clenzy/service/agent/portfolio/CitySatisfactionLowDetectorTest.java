package com.clenzy.service.agent.portfolio;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class CitySatisfactionLowDetectorTest {

    private CitySatisfactionLowDetector detector;
    private PortfolioConfig config;
    private PortfolioPatternTemplate template;

    @BeforeEach
    void setUp() {
        detector = new CitySatisfactionLowDetector();
        config = new PortfolioConfig();
        template = new PortfolioPatternTemplate();
        template.id = "city_satisfaction_low";
        template.type = "CITY_SATISFACTION_LOW";
        template.title = "Satisfaction faible par ville";
        template.description = "{count} ville(s) avec rating moyen <{thresholdRating}/5";
        template.severity = "HIGH";
    }

    private static PortfolioPatternDetector.PropertyMetric metric(
            Long id, String city, Double rating) {
        return new PortfolioPatternDetector.PropertyMetric(
                id, "P" + id, city, "ACTIVE",
                100.0, 5L, 1, 0, rating);
    }

    @Test
    void detector_id_matchesYaml() {
        assertEquals("city_satisfaction_low", detector.patternId());
    }

    @Test
    void evaluate_cityBelowThreshold_detected() {
        var input = new PortfolioPatternDetector.PortfolioInput(List.of(
                metric(1L, "Marseille", 2.5),
                metric(2L, "Marseille", 3.0)
                // moyenne Marseille = 2.75 < 3.5
        ), config);

        Optional<Map<String, Object>> result = detector.evaluate(input, template);
        assertTrue(result.isPresent());
        Map<String, Object> pattern = result.get();
        @SuppressWarnings("unchecked")
        List<String> items = (List<String>) pattern.get("items");
        assertEquals(1, items.size());
        assertTrue(items.get(0).contains("Marseille"));
        assertTrue(items.get(0).contains("2.75"));
    }

    @Test
    void evaluate_separatesCitiesAndOnlyFlagsBelowThreshold() {
        var input = new PortfolioPatternDetector.PortfolioInput(List.of(
                metric(1L, "Marseille", 2.5),
                metric(2L, "Lyon", 4.5) // au-dessus → ignore
        ), config);

        Map<String, Object> pattern = detector.evaluate(input, template).orElseThrow();
        @SuppressWarnings("unchecked")
        List<String> items = (List<String>) pattern.get("items");
        assertEquals(1, items.size());
        assertFalse(items.get(0).contains("Lyon"));
    }

    @Test
    void evaluate_noCityBelow_returnsEmpty() {
        var input = new PortfolioPatternDetector.PortfolioInput(List.of(
                metric(1L, "Paris", 4.2),
                metric(2L, "Lyon", 4.7)
        ), config);
        assertTrue(detector.evaluate(input, template).isEmpty());
    }

    @Test
    void evaluate_skipsPropertiesWithoutRating() {
        var input = new PortfolioPatternDetector.PortfolioInput(List.of(
                metric(1L, "Marseille", null),
                metric(2L, "Marseille", null)
        ), config);
        assertTrue(detector.evaluate(input, template).isEmpty());
    }

    @Test
    void evaluate_thresholdOverridableViaConfig() {
        config.setLowRatingThreshold(5.0); // tres haut → tout flag
        var input = new PortfolioPatternDetector.PortfolioInput(List.of(
                metric(1L, "Paris", 4.5)
        ), config);
        assertTrue(detector.evaluate(input, template).isPresent());

        config.setLowRatingThreshold(1.0); // tres bas → rien flag
        assertTrue(detector.evaluate(input, template).isEmpty());
    }
}
