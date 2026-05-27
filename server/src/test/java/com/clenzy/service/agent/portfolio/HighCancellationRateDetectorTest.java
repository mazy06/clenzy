package com.clenzy.service.agent.portfolio;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class HighCancellationRateDetectorTest {

    private HighCancellationRateDetector detector;
    private PortfolioConfig config;
    private PortfolioPatternTemplate template;

    @BeforeEach
    void setUp() {
        detector = new HighCancellationRateDetector();
        config = new PortfolioConfig();
        template = new PortfolioPatternTemplate();
        template.id = "high_cancellation_rate";
        template.type = "HIGH_CANCELLATION_RATE";
        template.title = "Taux d'annulation eleve";
        template.description = "{count} propriete(s) avec >{thresholdPct}% d'annulations";
        template.severity = "MEDIUM";
        template.severityRules = Map.of("HIGH", "count >= 3");
    }

    private static PortfolioPatternDetector.PropertyMetric metric(
            Long id, String name, int total, int cancelled) {
        return new PortfolioPatternDetector.PropertyMetric(
                id, name, "Paris", "ACTIVE",
                100.0, 5L, total, cancelled, null);
    }

    @Test
    void detector_id_matchesYaml() {
        assertEquals("high_cancellation_rate", detector.patternId());
    }

    @Test
    void evaluate_propertyAboveThreshold_detected() {
        // 3 cancelled / 4 total = 75% > 20% threshold
        var input = new PortfolioPatternDetector.PortfolioInput(
                List.of(metric(1L, "Loft", 4, 3)), config);

        Optional<Map<String, Object>> result = detector.evaluate(input, template);
        assertTrue(result.isPresent());
        Map<String, Object> pattern = result.get();
        assertEquals("HIGH_CANCELLATION_RATE", pattern.get("type"));
        assertEquals("MEDIUM", pattern.get("severity"), "1 item < 3 → MEDIUM default");
        @SuppressWarnings("unchecked")
        List<String> items = (List<String>) pattern.get("items");
        assertEquals(1, items.size());
        assertTrue(items.get(0).contains("Loft"));
        assertTrue(items.get(0).contains("75%"));
    }

    @Test
    void evaluate_threeOrMore_promotesSeverityToHigh() {
        var input = new PortfolioPatternDetector.PortfolioInput(List.of(
                metric(1L, "A", 4, 3),
                metric(2L, "B", 4, 3),
                metric(3L, "C", 4, 3)
        ), config);

        Map<String, Object> pattern = detector.evaluate(input, template).orElseThrow();
        assertEquals("HIGH", pattern.get("severity"), "3+ items → HIGH via severityRule");
    }

    @Test
    void evaluate_belowMinSample_ignored() {
        config.setMinReservationsForVolatility(5);
        // 2 cancelled / 3 total mais 3 < min=5 → ignore
        var input = new PortfolioPatternDetector.PortfolioInput(
                List.of(metric(1L, "Small", 3, 2)), config);
        assertTrue(detector.evaluate(input, template).isEmpty());
    }

    @Test
    void evaluate_belowThreshold_ignored() {
        // 1 cancelled / 10 total = 10% < 20% → not flagged
        var input = new PortfolioPatternDetector.PortfolioInput(
                List.of(metric(1L, "Low", 10, 1)), config);
        assertTrue(detector.evaluate(input, template).isEmpty());
    }

    @Test
    void evaluate_thresholdOverridable_viaConfig() {
        config.setHighCancellationRate(0.50); // bump a 50%
        // 30% < 50% → plus de pattern
        var input = new PortfolioPatternDetector.PortfolioInput(
                List.of(metric(1L, "P", 10, 3)), config);
        assertTrue(detector.evaluate(input, template).isEmpty());

        // Mais 60% > 50% → pattern
        var input2 = new PortfolioPatternDetector.PortfolioInput(
                List.of(metric(1L, "P", 10, 6)), config);
        assertTrue(detector.evaluate(input2, template).isPresent());
    }

    @Test
    void evaluate_emptyPortfolio_returnsEmpty() {
        var input = new PortfolioPatternDetector.PortfolioInput(List.of(), config);
        assertTrue(detector.evaluate(input, template).isEmpty());
    }

    @Test
    void evaluate_descriptionInterpolated() {
        var input = new PortfolioPatternDetector.PortfolioInput(
                List.of(metric(1L, "L", 4, 3)), config);
        Map<String, Object> pattern = detector.evaluate(input, template).orElseThrow();
        String desc = (String) pattern.get("description");
        assertTrue(desc.contains("1"), "Count interpole");
        assertTrue(desc.contains("20"), "ThresholdPct interpole");
    }
}
