package com.clenzy.service.agent.portfolio;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class PortfolioPatternTemplateTest {

    @Test
    void resolveSeverity_noRules_returnsDefault() {
        PortfolioPatternTemplate t = new PortfolioPatternTemplate();
        t.severity = "MEDIUM";
        assertEquals("MEDIUM", t.resolveSeverity(Map.of("count", 1)));
    }

    @Test
    void resolveSeverity_matchedRule_overridesDefault() {
        PortfolioPatternTemplate t = new PortfolioPatternTemplate();
        t.severity = "MEDIUM";
        t.severityRules = Map.of("HIGH", "count >= 3");
        assertEquals("HIGH", t.resolveSeverity(Map.of("count", 5)));
        assertEquals("MEDIUM", t.resolveSeverity(Map.of("count", 2)));
    }

    @Test
    void resolveSeverity_picksHighestMatchingLevel() {
        PortfolioPatternTemplate t = new PortfolioPatternTemplate();
        t.severity = "LOW";
        // Iterations CRITICAL > HIGH > MEDIUM > LOW (highest-first)
        Map<String, String> rules = new LinkedHashMap<>();
        rules.put("MEDIUM", "count >= 1");
        rules.put("HIGH", "count >= 3");
        rules.put("CRITICAL", "count >= 10");
        t.severityRules = rules;
        assertEquals("CRITICAL", t.resolveSeverity(Map.of("count", 10)));
        assertEquals("HIGH", t.resolveSeverity(Map.of("count", 5)));
        assertEquals("MEDIUM", t.resolveSeverity(Map.of("count", 1)));
        assertEquals("LOW", t.resolveSeverity(Map.of("count", 0)));
    }

    @Test
    void evaluateSeverityRule_supportsAllOperators() {
        Map<String, Number> vars = Map.of("count", 5, "ratio", 0.75);
        assertTrue(PortfolioPatternTemplate.evaluateSeverityRule("count >= 5", vars));
        assertTrue(PortfolioPatternTemplate.evaluateSeverityRule("count > 4", vars));
        assertTrue(PortfolioPatternTemplate.evaluateSeverityRule("count <= 5", vars));
        assertTrue(PortfolioPatternTemplate.evaluateSeverityRule("count < 10", vars));
        assertTrue(PortfolioPatternTemplate.evaluateSeverityRule("count == 5", vars));
        assertTrue(PortfolioPatternTemplate.evaluateSeverityRule("ratio >= 0.5", vars));
        assertFalse(PortfolioPatternTemplate.evaluateSeverityRule("count >= 10", vars));
    }

    @Test
    void evaluateSeverityRule_invalidFormat_returnsFalse() {
        Map<String, Number> vars = Map.of("count", 5);
        assertFalse(PortfolioPatternTemplate.evaluateSeverityRule("count BAD 5", vars));
        assertFalse(PortfolioPatternTemplate.evaluateSeverityRule("", vars));
        assertFalse(PortfolioPatternTemplate.evaluateSeverityRule(null, vars));
        assertFalse(PortfolioPatternTemplate.evaluateSeverityRule("nope >= 5", vars));
        assertFalse(PortfolioPatternTemplate.evaluateSeverityRule("count >= xyz", vars));
    }

    @Test
    void renderDescription_interpolatesPlaceholders() {
        PortfolioPatternTemplate t = new PortfolioPatternTemplate();
        t.description = "{count} propriete(s) avec >{threshold}% d'annulations";
        Map<String, Object> vars = new LinkedHashMap<>();
        vars.put("count", 3);
        vars.put("threshold", 20);
        assertEquals("3 propriete(s) avec >20% d'annulations", t.renderDescription(vars));
    }

    @Test
    void renderDescription_missingPlaceholder_leftAsIs() {
        PortfolioPatternTemplate t = new PortfolioPatternTemplate();
        t.description = "{count} pour {unknown}";
        assertEquals("3 pour {unknown}", t.renderDescription(Map.of("count", 3)));
    }
}
