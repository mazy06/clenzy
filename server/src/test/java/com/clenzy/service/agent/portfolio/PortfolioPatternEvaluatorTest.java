package com.clenzy.service.agent.portfolio;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PortfolioPatternEvaluatorTest {

    private static PortfolioPatternTemplate template(String id, String type) {
        PortfolioPatternTemplate t = new PortfolioPatternTemplate();
        t.id = id;
        t.type = type;
        t.title = "T";
        t.severity = "LOW";
        return t;
    }

    @Test
    void evaluateAll_callsDetectorOnlyIfTemplateExists() {
        PortfolioPatternRegistry registry = mock(PortfolioPatternRegistry.class);
        when(registry.all()).thenReturn(List.of(template("p1", "T1")));

        PortfolioPatternDetector detector1 = mock(PortfolioPatternDetector.class);
        when(detector1.patternId()).thenReturn("p1");
        when(detector1.evaluate(any(), any()))
                .thenReturn(Optional.of(Map.of("type", "T1", "severity", "LOW")));

        PortfolioPatternDetector detector2 = mock(PortfolioPatternDetector.class);
        when(detector2.patternId()).thenReturn("p2"); // n'apparait pas dans le YAML
        when(detector2.evaluate(any(), any())).thenReturn(Optional.empty());

        PortfolioPatternEvaluator evaluator = new PortfolioPatternEvaluator(
                registry, List.of(detector1, detector2));

        var input = new PortfolioPatternDetector.PortfolioInput(List.of(), new PortfolioConfig());
        List<Map<String, Object>> result = evaluator.evaluateAll(input);

        assertEquals(1, result.size());
        // detector2 ne devrait pas etre appele (pas de template)
        verify(detector1).evaluate(eq(input), any());
        verify(detector2, never()).evaluate(any(), any());
    }

    @Test
    void evaluateAll_preservesYamlOrder() {
        PortfolioPatternRegistry registry = mock(PortfolioPatternRegistry.class);
        when(registry.all()).thenReturn(List.of(
                template("p1", "T1"), template("p2", "T2"), template("p3", "T3")));

        PortfolioPatternDetector d1 = mockDetector("p1", "T1");
        PortfolioPatternDetector d2 = mockDetector("p2", "T2");
        PortfolioPatternDetector d3 = mockDetector("p3", "T3");

        PortfolioPatternEvaluator evaluator = new PortfolioPatternEvaluator(
                registry, List.of(d3, d1, d2)); // injection desordonnee

        List<Map<String, Object>> result = evaluator.evaluateAll(
                new PortfolioPatternDetector.PortfolioInput(List.of(), new PortfolioConfig()));

        // Ordre yaml respecte : T1, T2, T3
        assertEquals(List.of("T1", "T2", "T3"),
                result.stream().map(m -> (String) m.get("type")).toList());
    }

    @Test
    void evaluateAll_oneDetectorThrows_othersContinue() {
        PortfolioPatternRegistry registry = mock(PortfolioPatternRegistry.class);
        when(registry.all()).thenReturn(List.of(
                template("crash", "X"), template("ok", "OK")));

        PortfolioPatternDetector crashy = mock(PortfolioPatternDetector.class);
        when(crashy.patternId()).thenReturn("crash");
        when(crashy.evaluate(any(), any())).thenThrow(new RuntimeException("boom"));

        PortfolioPatternDetector okDetector = mockDetector("ok", "OK");

        PortfolioPatternEvaluator evaluator = new PortfolioPatternEvaluator(
                registry, List.of(crashy, okDetector));

        List<Map<String, Object>> result = evaluator.evaluateAll(
                new PortfolioPatternDetector.PortfolioInput(List.of(), new PortfolioConfig()));

        // crashy a pete mais okDetector a quand meme tourne
        assertEquals(1, result.size());
        assertEquals("OK", result.get(0).get("type"));
    }

    @Test
    void evaluateAll_emptyRegistry_returnsEmpty() {
        PortfolioPatternRegistry registry = mock(PortfolioPatternRegistry.class);
        when(registry.all()).thenReturn(List.of());
        PortfolioPatternEvaluator evaluator = new PortfolioPatternEvaluator(registry, List.of());
        assertTrue(evaluator.evaluateAll(
                new PortfolioPatternDetector.PortfolioInput(List.of(), new PortfolioConfig()))
                .isEmpty());
    }

    private static PortfolioPatternDetector mockDetector(String id, String type) {
        PortfolioPatternDetector d = mock(PortfolioPatternDetector.class);
        when(d.patternId()).thenReturn(id);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("type", type);
        result.put("severity", "LOW");
        when(d.evaluate(any(), any())).thenReturn(Optional.of(result));
        return d;
    }
}
