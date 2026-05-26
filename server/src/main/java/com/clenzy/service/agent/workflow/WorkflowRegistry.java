package com.clenzy.service.agent.workflow;

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

/**
 * Registre des workflows charges au boot depuis {@code resources/workflows/*.yaml}.
 *
 * <p>Au demarrage, le registre liste tous les fichiers YAML du dossier, les
 * parse via Jackson YAML, valide l'ID + au moins 1 step, et indexe par
 * {@link WorkflowDefinition#id}. Les YAML invalides sont logges en warn et
 * ignores — un workflow casse n'empeche pas les autres de demarrer.</p>
 */
@Service
public class WorkflowRegistry {

    private static final Logger log = LoggerFactory.getLogger(WorkflowRegistry.class);
    private static final String WORKFLOWS_LOCATION = "classpath:workflows/*.yaml";

    private final ObjectMapper yamlMapper;
    private final ResourcePatternResolver resourceResolver;
    private Map<String, WorkflowDefinition> definitionsById = Collections.emptyMap();

    public WorkflowRegistry() {
        this.yamlMapper = new YAMLMapper();
        this.resourceResolver = new PathMatchingResourcePatternResolver(
                WorkflowRegistry.class.getClassLoader());
    }

    /** Constructeur d'injection pour faciliter les tests (resolver custom). */
    WorkflowRegistry(ObjectMapper yamlMapper, ResourcePatternResolver resourceResolver) {
        this.yamlMapper = yamlMapper;
        this.resourceResolver = resourceResolver;
    }

    @PostConstruct
    void loadAll() {
        Map<String, WorkflowDefinition> loaded = new LinkedHashMap<>();
        try {
            Resource[] resources = resourceResolver.getResources(WORKFLOWS_LOCATION);
            for (Resource resource : resources) {
                tryLoad(resource).ifPresent(def -> {
                    if (loaded.containsKey(def.id)) {
                        log.warn("WorkflowRegistry: duplicate id '{}' (ignoring {})",
                                def.id, resource.getFilename());
                        return;
                    }
                    loaded.put(def.id, def);
                });
            }
        } catch (IOException e) {
            log.warn("WorkflowRegistry: scan failed, no workflows loaded — {}", e.getMessage());
        }
        this.definitionsById = Collections.unmodifiableMap(loaded);
        log.info("WorkflowRegistry initialise avec {} workflows : {}",
                definitionsById.size(), definitionsById.keySet());
    }

    private Optional<WorkflowDefinition> tryLoad(Resource resource) {
        try (InputStream is = resource.getInputStream()) {
            WorkflowDefinition def = yamlMapper.readValue(is, WorkflowDefinition.class);
            if (def == null || def.id == null || def.id.isBlank()) {
                log.warn("WorkflowRegistry: id manquant dans {}", resource.getFilename());
                return Optional.empty();
            }
            if (def.steps == null || def.steps.isEmpty()) {
                log.warn("WorkflowRegistry: aucun step dans '{}' (ignored)", def.id);
                return Optional.empty();
            }
            // Verification minimale par step : id + prompt
            for (int i = 0; i < def.steps.size(); i++) {
                WorkflowDefinition.Step s = def.steps.get(i);
                if (s == null || s.id == null || s.id.isBlank()
                        || s.prompt == null || s.prompt.isBlank()) {
                    log.warn("WorkflowRegistry: step #{} invalide dans '{}' (id/prompt manquant) — workflow ignore",
                            i, def.id);
                    return Optional.empty();
                }
            }
            return Optional.of(def);
        } catch (IOException e) {
            log.warn("WorkflowRegistry: parsing failed for {} ({})", resource.getFilename(), e.getMessage());
            return Optional.empty();
        }
    }

    /** Resolution d'un workflow par son id. */
    public Optional<WorkflowDefinition> getById(String id) {
        if (id == null) return Optional.empty();
        return Optional.ofNullable(definitionsById.get(id));
    }

    /** Liste de tous les workflows charges (ordre d'iteration stable = ordre d'insertion). */
    public List<WorkflowDefinition> listAll() {
        return List.copyOf(definitionsById.values());
    }

    /** Nombre de workflows. */
    public int size() {
        return definitionsById.size();
    }
}
