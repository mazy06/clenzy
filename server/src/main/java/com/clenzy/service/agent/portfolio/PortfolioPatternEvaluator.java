package com.clenzy.service.agent.portfolio;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Orchestre la detection de tous les patterns activés pour un portfolio.
 *
 * <p>Pipeline :
 * <ol>
 *   <li>Pour chaque {@link PortfolioPatternDetector} bean (injectes par Spring),
 *       on resout le template depuis {@link PortfolioPatternRegistry}.</li>
 *   <li>Si le pattern est present + active dans le YAML, on appelle
 *       {@link PortfolioPatternDetector#evaluate}.</li>
 *   <li>On collecte les patterns detectes dans l'ordre d'apparition dans le YAML.</li>
 * </ol>
 *
 * <p>Si un detector throw, on log et on continue avec les autres (resilience).</p>
 */
@Service
public class PortfolioPatternEvaluator {

    private final PortfolioPatternRegistry registry;
    private final Map<String, PortfolioPatternDetector> detectorsById;

    public PortfolioPatternEvaluator(PortfolioPatternRegistry registry,
                                       List<PortfolioPatternDetector> detectors) {
        this.registry = registry;
        this.detectorsById = detectors.stream()
                .collect(Collectors.toMap(PortfolioPatternDetector::patternId,
                        Function.identity(), (a, b) -> a));
    }

    /**
     * Evalue tous les patterns sur un input agreg. Retourne la liste des patterns
     * detectes (peut etre vide). L'ordre suit celui des templates dans le YAML.
     */
    public List<Map<String, Object>> evaluateAll(PortfolioPatternDetector.PortfolioInput input) {
        List<Map<String, Object>> detected = new ArrayList<>();
        for (PortfolioPatternTemplate template : registry.all()) {
            PortfolioPatternDetector detector = detectorsById.get(template.id);
            if (detector == null) {
                // Template sans detector → ignore (cas warning au boot)
                continue;
            }
            try {
                Optional<Map<String, Object>> result = detector.evaluate(input, template);
                result.ifPresent(detected::add);
            } catch (Exception e) {
                // Resilience : un detector qui pete ne casse pas les autres
                // (au pire on log)
            }
        }
        return detected;
    }
}
