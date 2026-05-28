package com.clenzy.service.agent.prompt;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Implementation Spring-managed du {@link SystemPromptComposer}.
 *
 * <p><b>SOLID</b> :
 * <ul>
 *   <li><b>SRP</b> : assembler les sections — la connaissance des sections est externalisee (DI)</li>
 *   <li><b>OCP</b> : ajouter une section ne touche pas ce fichier (Spring auto-injection)</li>
 *   <li><b>DIP</b> : depend des abstractions {@link PromptSection} via {@link ObjectProvider}</li>
 * </ul>
 * </p>
 *
 * <h3>Performance</h3>
 * <ul>
 *   <li>Tri des sections cache en {@link AtomicReference} (immutable list) — calcul une seule fois
 *       a la premiere invocation, tous les threads partagent la meme liste triee.</li>
 *   <li>StringBuilder pre-dimensionne (4 KB) pour eviter les realloc.</li>
 *   <li>Metrics Micrometer (timer + section count) pour observabilite prod.</li>
 * </ul>
 *
 * <h3>Thread-safety</h3>
 * <ul>
 *   <li>Sections injectees via ObjectProvider — leur singleton-ness est garantie par Spring.</li>
 *   <li>{@link AtomicReference} pour le cache de la liste triee (lazy init thread-safe).</li>
 *   <li>StringBuilder local a chaque appel (pas de partage).</li>
 * </ul>
 */
@Component
public class DefaultSystemPromptComposer implements SystemPromptComposer {

    private static final Logger log = LoggerFactory.getLogger(DefaultSystemPromptComposer.class);

    /** Capacite initiale du StringBuilder (4 KB ~ taille moyenne observee d'un prompt). */
    private static final int INITIAL_BUILDER_CAPACITY = 4096;

    /** Separateur entre 2 sections rendues. */
    private static final String SECTION_SEPARATOR = "\n\n";

    private final ObjectProvider<PromptSection> sectionsProvider;
    private final MeterRegistry meterRegistry;
    private final Timer composeTimer;

    /**
     * Counter pre-build (eviter le ConcurrentHashMap lookup a chaque compose).
     * Hot path : 100s/sec → cache un seul Counter object reutilise pour les
     * milliers d'increments.
     */
    private final Counter sectionsRenderedCounter;

    /**
     * Cache des Counters par-section (errors). Cle = section name. Construit
     * lazily a la 1ere erreur d'une section donnee. Errors etant rares,
     * lazy-init est OK et evite de construire N counters au boot.
     */
    private final ConcurrentMap<String, Counter> sectionErrorCounters = new ConcurrentHashMap<>();

    /**
     * Cache de la liste triee des sections. Calculee une seule fois (lazy)
     * apres le premier {@link #compose}, partagee entre threads.
     *
     * <p>{@link AtomicReference} permet le compare-and-set sans synchronisation
     * lourde (acceptable car le calcul est idempotent : meme resultat quel que
     * soit le thread qui "gagne" la course).</p>
     */
    private final AtomicReference<List<PromptSection>> sortedSectionsCache = new AtomicReference<>();

    public DefaultSystemPromptComposer(ObjectProvider<PromptSection> sectionsProvider,
                                         MeterRegistry meterRegistry) {
        this.sectionsProvider = sectionsProvider;
        this.meterRegistry = meterRegistry;
        this.composeTimer = Timer.builder("assistant.prompt.compose")
                .description("Latence de composition du system prompt")
                .publishPercentiles(0.5, 0.95, 0.99)
                .register(meterRegistry);
        this.sectionsRenderedCounter = Counter.builder("assistant.prompt.sections_rendered")
                .description("Nombre de sections rendues (cumule par invocation)")
                .register(meterRegistry);
    }

    @Override
    public String compose(PromptContext context) {
        long startNanos = System.nanoTime();
        try {
            List<PromptSection> sorted = resolveSorted();
            StringBuilder builder = new StringBuilder(INITIAL_BUILDER_CAPACITY);
            int rendered = 0;
            for (PromptSection section : sorted) {
                if (!section.appliesTo(context)) continue;
                Optional<String> content = safeRender(section, context);
                if (content.isEmpty()) continue;
                String trimmed = content.get().strip();
                if (trimmed.isEmpty()) continue;
                if (!builder.isEmpty()) builder.append(SECTION_SEPARATOR);
                builder.append(trimmed);
                rendered++;
            }
            // Telemetry : counter pre-build (pas de lookup ConcurrentHashMap a chaque call)
            sectionsRenderedCounter.increment(rendered);
            return builder.toString();
        } finally {
            composeTimer.record(System.nanoTime() - startNanos, TimeUnit.NANOSECONDS);
        }
    }

    /**
     * Rend une section en interceptant toute exception : un bug dans UNE section
     * ne doit JAMAIS planter l'agent. On log et on skip.
     */
    private Optional<String> safeRender(PromptSection section, PromptContext context) {
        try {
            return section.render(context);
        } catch (Exception e) {
            log.warn("PromptSection [{}] threw during render — skipped : {}",
                    section.name(), e.getMessage());
            // Lazy-cache : compute Counter une fois par section name (errors rares)
            sectionErrorCounters.computeIfAbsent(section.name(), name ->
                    Counter.builder("assistant.prompt.section_errors")
                            .tag("section", name)
                            .register(meterRegistry)
            ).increment();
            return Optional.empty();
        }
    }

    /**
     * Lazy-init thread-safe de la liste triee. Plusieurs threads peuvent
     * calculer la liste simultanement (idempotent) ; le dernier compareAndSet
     * gagne, les autres jettent leur calcul. C'est moins cher qu'un lock dans
     * le hot path (compose est appele a chaque message user).
     */
    private List<PromptSection> resolveSorted() {
        List<PromptSection> cached = sortedSectionsCache.get();
        if (cached != null) return cached;
        List<PromptSection> sorted = sectionsProvider.stream()
                .sorted(Comparator.comparingInt(PromptSection::order)
                        .thenComparing(PromptSection::name))
                .toList();
        sortedSectionsCache.compareAndSet(null, sorted);
        // Retourner la valeur effectivement publiee (autre thread peut avoir set entre temps)
        return sortedSectionsCache.get();
    }
}
