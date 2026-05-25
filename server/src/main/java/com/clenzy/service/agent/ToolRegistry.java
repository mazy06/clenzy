package com.clenzy.service.agent;

import com.clenzy.config.ai.ToolDescriptor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Registre central des {@link ToolHandler} disponibles pour l'assistant.
 *
 * <p>Construit a partir de l'injection de tous les beans {@link ToolHandler}
 * (auto-decouverte Spring). Verifie au boot l'unicite des noms et la coherence
 * entre {@link ToolHandler#name()} et {@link ToolDescriptor#name()}.</p>
 *
 * <p><b>Usage par l'orchestrateur</b> : {@link #listDescriptors()} pour construire
 * la liste {@code tools} envoyee au LLM ; {@link #find(String)} pour resoudre
 * un tool_call recu en streaming.</p>
 */
@Service
public class ToolRegistry {

    private static final Logger log = LoggerFactory.getLogger(ToolRegistry.class);

    private final Map<String, ToolHandler> handlersByName;

    public ToolRegistry(List<ToolHandler> handlers) {
        // Verification d'unicite — un conflit doit etre detecte au boot, pas a runtime.
        Map<String, ToolHandler> byName = new java.util.LinkedHashMap<>();
        for (ToolHandler h : handlers) {
            String name = h.name();
            if (name == null || name.isBlank()) {
                throw new IllegalStateException(
                        "ToolHandler " + h.getClass().getName() + " returns blank name()");
            }
            if (!name.equals(h.descriptor().name())) {
                throw new IllegalStateException(
                        "ToolHandler " + h.getClass().getName() + " has mismatched name='"
                                + name + "' vs descriptor.name='" + h.descriptor().name() + "'");
            }
            ToolHandler previous = byName.put(name, h);
            if (previous != null) {
                throw new IllegalStateException("Duplicate tool name '" + name + "' between "
                        + previous.getClass().getName() + " and " + h.getClass().getName());
            }
        }
        // Collections.unmodifiableMap preserves LinkedHashMap iteration order
        // (Map.copyOf returns a hash-based map without order guarantees).
        this.handlersByName = Collections.unmodifiableMap(byName);
        log.info("ToolRegistry initialise avec {} tools : {}",
                handlersByName.size(), handlersByName.keySet());
    }

    /** Tous les descripteurs (pour les envoyer au LLM). */
    public List<ToolDescriptor> listDescriptors() {
        return handlersByName.values().stream()
                .map(ToolHandler::descriptor)
                .collect(Collectors.toUnmodifiableList());
    }

    /** Resout un tool par nom (utilise par l'orchestrateur quand le LLM emet un tool_call). */
    public Optional<ToolHandler> find(String name) {
        return Optional.ofNullable(handlersByName.get(name));
    }

    /** Nombre de tools enregistres. */
    public int size() {
        return handlersByName.size();
    }
}
