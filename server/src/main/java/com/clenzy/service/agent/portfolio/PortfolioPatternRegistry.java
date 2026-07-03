package com.clenzy.service.agent.portfolio;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.core.io.support.ResourcePatternResolver;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Charge {@code resources/patterns/portfolio.yaml} au boot. Le fichier
 * declare la liste des patterns avec leurs labels/severite/seuils.
 *
 * <p>Pour la logique de detection, voir les beans {@link PortfolioPatternDetector}.
 * Le registry expose un mapping {@code patternId → template} que les detectors
 * peuvent recuperer via {@link #getTemplate}.</p>
 *
 * <p>Comportement defensif : YAML invalide / absent → registry vide, le tool
 * retourne 0 pattern (au lieu de crasher).</p>
 */
@Service
public class PortfolioPatternRegistry {

    private static final Logger log = LoggerFactory.getLogger(PortfolioPatternRegistry.class);
    private static final String LOCATION = "classpath:patterns/portfolio.yaml";

    private final ObjectMapper yamlMapper;
    private final ResourcePatternResolver resourceResolver;
    private Map<String, PortfolioPatternTemplate> templatesById = Collections.emptyMap();

    // Constructeur Spring voulu (defauts autosuffisants) — @Autowired explicite car
    // la classe declare aussi un constructeur de test (regle ArchUnit 2026-07-02).
    @Autowired
    public PortfolioPatternRegistry() {
        this.yamlMapper = new YAMLMapper();
        this.resourceResolver = new PathMatchingResourcePatternResolver(
                PortfolioPatternRegistry.class.getClassLoader());
    }

    /** Constructeur pour tests : permet d'injecter un ResourceResolver custom. */
    PortfolioPatternRegistry(ObjectMapper yamlMapper, ResourcePatternResolver resourceResolver) {
        this.yamlMapper = yamlMapper;
        this.resourceResolver = resourceResolver;
    }

    @PostConstruct
    void loadAll() {
        Map<String, PortfolioPatternTemplate> loaded = new LinkedHashMap<>();
        try {
            Resource resource = resourceResolver.getResource(LOCATION);
            if (!resource.exists()) {
                log.warn("PortfolioPatternRegistry : {} introuvable — aucun pattern charge",
                        LOCATION);
                return;
            }
            try (InputStream is = resource.getInputStream()) {
                PatternsFile file = yamlMapper.readValue(is, PatternsFile.class);
                if (file == null || file.patterns == null) return;
                for (PortfolioPatternTemplate t : file.patterns) {
                    if (t == null || t.id == null || t.id.isBlank()) {
                        log.warn("PortfolioPatternRegistry : pattern sans id, ignored");
                        continue;
                    }
                    if (!t.enabled) {
                        log.debug("Pattern '{}' desactive", t.id);
                        continue;
                    }
                    if (loaded.containsKey(t.id)) {
                        log.warn("Pattern duplique '{}' — ignored", t.id);
                        continue;
                    }
                    loaded.put(t.id, t);
                }
            }
        } catch (IOException e) {
            log.warn("PortfolioPatternRegistry : parsing failed ({}), aucun pattern charge",
                    e.getMessage());
            return;
        }
        this.templatesById = Collections.unmodifiableMap(loaded);
        log.info("PortfolioPatternRegistry initialise : {} patterns charges {}",
                templatesById.size(), templatesById.keySet());
    }

    public Optional<PortfolioPatternTemplate> getTemplate(String patternId) {
        return Optional.ofNullable(templatesById.get(patternId));
    }

    public List<PortfolioPatternTemplate> all() {
        return List.copyOf(templatesById.values());
    }

    public int size() {
        return templatesById.size();
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class PatternsFile {
        public List<PortfolioPatternTemplate> patterns;
    }
}
