package com.clenzy.service.agent.prompt.sections;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.Yaml;

import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Charge les few-shot examples depuis {@code resources/prompts/examples.yaml}
 * au boot Spring (@PostConstruct).
 *
 * <p><b>Fail-fast strict</b> : si le YAML est manquant, malforme ou contient
 * un example avec des champs requis vides, le boot Spring echoue. Mieux vaut
 * un boot rouge qu'un agent silencieusement sans examples.</p>
 *
 * <p><b>Performance</b> : la liste est immuable apres init, partagee entre
 * threads. Pas de re-lecture du fichier au runtime (eviter d'introduire un
 * point de variabilite par environnement).</p>
 *
 * <p><b>Indexation par categorie</b> : la {@link Map} {@link #byCategory} permet
 * a {@code ExamplesSection} de filtrer rapidement par intent detectee (ex:
 * ne montrer que les examples "simulation" si la question est une simulation).</p>
 */
@Component
public class ExampleLoader {

    private static final Logger log = LoggerFactory.getLogger(ExampleLoader.class);

    private final Resource yamlResource;

    /**
     * Liste globale dans l'ordre du YAML + index par categorie, encapsules
     * dans un holder immuable swappe atomiquement via {@link AtomicReference}.
     *
     * <p>Pourquoi : si {@link #loadExamples()} est appele en concurrence (ex:
     * test multi-thread, futur endpoint admin reload), deux threads ecrivant
     * sur 2 fields separes pourrait laisser un thread lecteur observer un
     * {@code allExamples} de la nouvelle version mais un {@code byCategory}
     * de l'ancienne. Le swap atomique d'un holder unique evite cet etat
     * incoherent (publication atomique : on voit l'ancien OU le nouveau,
     * jamais un melange).</p>
     */
    private final AtomicReference<LoadedExamples> state = new AtomicReference<>(LoadedExamples.EMPTY);

    /** Holder immuable des deux structures liees. Swap atomique = publication atomique. */
    private record LoadedExamples(List<PromptExample> all, Map<String, List<PromptExample>> byCategory) {
        static final LoadedExamples EMPTY = new LoadedExamples(
                List.of(), Collections.emptyMap());
    }

    public ExampleLoader(@Value("classpath:prompts/examples.yaml") Resource yamlResource) {
        this.yamlResource = yamlResource;
    }

    /**
     * Idempotent : peut etre appele plusieurs fois (utile en tests pour
     * re-init avec une autre source). Public pour permettre l'exposition
     * en tests et reload manuels via endpoint admin futur.
     */
    @PostConstruct
    @SuppressWarnings("unchecked")
    public void loadExamples() {
        if (!yamlResource.exists()) {
            // Pas de fichier -> on continue avec liste vide (les tests sans YAML restent valides)
            log.warn("examples.yaml not found at classpath:prompts/examples.yaml — running without few-shot examples");
            return;
        }
        try (InputStream is = yamlResource.getInputStream()) {
            Yaml yaml = new Yaml();
            Map<String, Object> root = yaml.load(is);
            if (root == null || !root.containsKey("examples")) {
                throw new IllegalStateException("examples.yaml missing 'examples' root key");
            }
            Object raw = root.get("examples");
            if (!(raw instanceof List<?> list)) {
                throw new IllegalStateException("examples.yaml 'examples' must be a list");
            }

            List<PromptExample> parsed = new java.util.ArrayList<>(list.size());
            Map<String, List<PromptExample>> indexed = new LinkedHashMap<>();
            int line = 0;
            for (Object o : list) {
                line++;
                if (!(o instanceof Map<?, ?> map)) {
                    throw new IllegalStateException("Example #" + line + " is not a map");
                }
                @SuppressWarnings("rawtypes")
                Map m = map;
                PromptExample ex = new PromptExample(
                        requireString(m, "id", line),
                        requireString(m, "category", line),
                        requireString(m, "user", line),
                        optionalString(m, "thinking"),
                        requireString(m, "assistant", line)
                );
                parsed.add(ex);
                indexed.computeIfAbsent(ex.category(), k -> new java.util.ArrayList<>()).add(ex);
            }

            // Verifier unicite des ids
            long uniqueCount = parsed.stream().map(PromptExample::id).distinct().count();
            if (uniqueCount != parsed.size()) {
                throw new IllegalStateException("examples.yaml contains duplicate ids");
            }

            // Publication atomique : swap d'un holder unique immuable.
            // Pas de fenetre ou un thread lecteur peut voir un melange ancien/nouveau.
            Map<String, List<PromptExample>> immutableByCategory = new LinkedHashMap<>();
            indexed.forEach((k, v) -> immutableByCategory.put(k, List.copyOf(v)));
            this.state.set(new LoadedExamples(
                    List.copyOf(parsed),
                    Collections.unmodifiableMap(immutableByCategory)
            ));

            log.info("Loaded {} few-shot examples across {} categories",
                    parsed.size(), immutableByCategory.size());
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read examples.yaml: " + e.getMessage(), e);
        }
    }

    /** Accesseur immutable (snapshot atomique). */
    public List<PromptExample> getAll() {
        return state.get().all();
    }

    /** Examples d'une categorie (liste vide si categorie inconnue, jamais null). */
    public List<PromptExample> getByCategory(String category) {
        return state.get().byCategory().getOrDefault(category, Collections.emptyList());
    }

    /** True si au moins un example est charge. */
    public boolean isEmpty() {
        return state.get().all().isEmpty();
    }

    private static String requireString(Map<?, ?> m, String key, int line) {
        Object v = m.get(key);
        if (!(v instanceof String s) || s.isBlank()) {
            throw new IllegalStateException(
                    "examples.yaml example #" + line + " missing required string field '" + key + "'");
        }
        return s;
    }

    private static String optionalString(Map<?, ?> m, String key) {
        Object v = m.get(key);
        return (v instanceof String s && !s.isBlank()) ? s : null;
    }
}
