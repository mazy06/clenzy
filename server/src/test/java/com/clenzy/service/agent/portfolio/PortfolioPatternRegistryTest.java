package com.clenzy.service.agent.portfolio;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.core.io.support.ResourcePatternResolver;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

class PortfolioPatternRegistryTest {

    private ObjectMapper yamlMapper;

    @BeforeEach
    void setUp() {
        yamlMapper = new YAMLMapper();
    }

    private PortfolioPatternRegistry buildWith(String yamlContent) {
        ResourcePatternResolver resolver = new PathMatchingResourcePatternResolver() {
            @Override
            public Resource getResource(String location) {
                return new ByteArrayResource(yamlContent.getBytes(StandardCharsets.UTF_8));
            }
        };
        PortfolioPatternRegistry r = new PortfolioPatternRegistry(yamlMapper, resolver);
        r.loadAll();
        return r;
    }

    @Test
    void loadAll_parsesActivePatterns() {
        PortfolioPatternRegistry r = buildWith("""
                patterns:
                  - id: high_cancellation
                    type: HIGH_CANCELLATION_RATE
                    title: "Test"
                    description: "{count}"
                    enabled: true
                  - id: low_satisfaction
                    type: CITY_LOW
                    title: "T"
                    description: "{count}"
                    enabled: true
                """);
        assertEquals(2, r.size());
        assertTrue(r.getTemplate("high_cancellation").isPresent());
        assertTrue(r.getTemplate("low_satisfaction").isPresent());
    }

    @Test
    void loadAll_skipsDisabledPatterns() {
        PortfolioPatternRegistry r = buildWith("""
                patterns:
                  - id: active
                    type: X
                    title: T
                    enabled: true
                  - id: inactive
                    type: Y
                    title: T
                    enabled: false
                """);
        assertEquals(1, r.size());
        assertTrue(r.getTemplate("active").isPresent());
        assertFalse(r.getTemplate("inactive").isPresent());
    }

    @Test
    void loadAll_ignoresPatternWithoutId() {
        PortfolioPatternRegistry r = buildWith("""
                patterns:
                  - type: NO_ID
                    title: T
                    enabled: true
                """);
        assertEquals(0, r.size());
    }

    @Test
    void loadAll_invalidYaml_emptyRegistry() {
        PortfolioPatternRegistry r = buildWith("not valid yaml :::: @@");
        assertEquals(0, r.size());
    }

    @Test
    void productionYaml_loadsAtLeastTwoPatterns() {
        // Sanity check : le YAML reel dans le repo doit avoir au moins les 2 patterns initiaux
        PortfolioPatternRegistry r = new PortfolioPatternRegistry();
        r.loadAll();
        assertTrue(r.size() >= 2, "Expected >=2 prod patterns, got " + r.size());
        assertTrue(r.getTemplate("high_cancellation_rate").isPresent());
        assertTrue(r.getTemplate("city_satisfaction_low").isPresent());
    }
}
