package com.clenzy.service.agent.multiagent;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Registre central des {@link AgentSpecialist} — auto-collection Spring DI.
 *
 * <p><b>OCP</b> : ajouter un spécialiste = nouveau {@code @Component}, ZERO
 * modification ici (provider stream injecte automatiquement les nouveaux beans).</p>
 *
 * <p><b>Validation au boot</b> :</p>
 * <ul>
 *   <li>Unicité des noms (échec rapide si conflit)</li>
 *   <li>Tool set ≤ 10 par specialiste (alerte sinon — degrade qualite routing)</li>
 *   <li>Tool set non-vide</li>
 *   <li>Description non-blank</li>
 * </ul>
 *
 * <p><b>Thread-safety</b> : carte des spécialistes calculée une fois au boot
 * via {@code @PostConstruct} et publiée atomiquement dans une
 * {@link AtomicReference}. Les accès en lecture sont sans lock.</p>
 */
@Component
public class SpecialistRegistry {

    private static final Logger log = LoggerFactory.getLogger(SpecialistRegistry.class);

    /** Plafond defensif — au-dela, le LLM perd en qualite de routing. */
    public static final int MAX_TOOLS_PER_SPECIALIST = 10;

    private final ObjectProvider<AgentSpecialist> specialistsProvider;

    /** Map par name. Publication atomique. */
    private final AtomicReference<Map<String, AgentSpecialist>> indexRef =
            new AtomicReference<>(Map.of());

    public SpecialistRegistry(ObjectProvider<AgentSpecialist> specialistsProvider) {
        this.specialistsProvider = specialistsProvider;
    }

    @PostConstruct
    void initialize() {
        Map<String, AgentSpecialist> map = new LinkedHashMap<>();
        specialistsProvider.stream().forEach(spec -> {
            validate(spec);
            AgentSpecialist previous = map.put(spec.name(), spec);
            if (previous != null) {
                throw new IllegalStateException(
                        "Duplicate AgentSpecialist name '" + spec.name() + "' : "
                                + previous.getClass() + " vs " + spec.getClass());
            }
        });
        indexRef.set(Map.copyOf(map));
        log.info("SpecialistRegistry initialized with {} specialists : {}",
                map.size(), map.keySet());
    }

    private static void validate(AgentSpecialist spec) {
        if (spec.name() == null || spec.name().isBlank()) {
            throw new IllegalStateException("AgentSpecialist " + spec.getClass() + " has blank name");
        }
        if (spec.description() == null || spec.description().isBlank()) {
            throw new IllegalStateException("AgentSpecialist '" + spec.name() + "' has blank description");
        }
        if (spec.domain() == null || spec.domain().isBlank()) {
            throw new IllegalStateException("AgentSpecialist '" + spec.name() + "' has blank domain");
        }
        Set<String> tools = spec.toolNames();
        if (tools == null || tools.isEmpty()) {
            throw new IllegalStateException("AgentSpecialist '" + spec.name() + "' has empty tool set");
        }
        if (tools.size() > MAX_TOOLS_PER_SPECIALIST) {
            // Warn but don't fail — Spécialiste peut depasser temporairement, mais c'est un signal
            log.warn("AgentSpecialist '{}' has {} tools (recommended ≤ {}). Routing quality may degrade.",
                    spec.name(), tools.size(), MAX_TOOLS_PER_SPECIALIST);
        }
    }

    /** Retourne un spécialiste par nom, ou empty si inconnu. */
    public Optional<AgentSpecialist> find(String name) {
        if (name == null) return Optional.empty();
        return Optional.ofNullable(indexRef.get().get(name));
    }

    /** Map immutable des spécialistes (pour l'orchestrator qui les liste dans son prompt). */
    public Map<String, AgentSpecialist> all() {
        return indexRef.get();
    }

    /** Nombre de specialistes enregistres. */
    public int size() {
        return indexRef.get().size();
    }
}
