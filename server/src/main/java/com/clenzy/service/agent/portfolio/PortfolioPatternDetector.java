package com.clenzy.service.agent.portfolio;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Strategie de detection d'un pattern cross-portfolio.
 *
 * <p>Modele SOLID : un detector = un type de pattern. Ajouter un pattern =
 * implementer cette interface + nouveau bean Spring + entree dans le YAML
 * {@code resources/patterns/portfolio.yaml}. Aucune modif du tool/orchestrator.</p>
 *
 * <p>La detection se fait en 2 phases :
 * <ol>
 *   <li>{@link #applies} : conditions metier (ex: assez de donnees, occupancy sous seuil)</li>
 *   <li>{@link #buildPattern} : compose le DTO avec les items, la severite resolue, le
 *       message i18n-ise</li>
 * </ol>
 */
public interface PortfolioPatternDetector {

    /** Identifiant stable du pattern, matche la cle {@code id} dans le YAML. */
    String patternId();

    /**
     * Evalue le pattern sur les metriques agregees du portfolio.
     *
     * @param input    metriques agregees (per property + globaux)
     * @param template configuration externe (titre, description, severite, threshold)
     * @return le pattern detecte (avec items + severity resolue) ou {@link Optional#empty()}
     *         si le pattern ne s'applique pas
     */
    Optional<Map<String, Object>> evaluate(PortfolioInput input, PortfolioPatternTemplate template);

    /**
     * Input agrege passe a chaque detector. Le tool {@code AnalyzePortfolioTool}
     * construit cet input UNE fois et le passe a tous les detectors.
     */
    record PortfolioInput(
            List<PropertyMetric> properties,
            PortfolioConfig config
    ) {}

    /** Metriques d'une propriete, vues par les detectors. */
    record PropertyMetric(
            Long id,
            String name,
            String city,
            String status, // PropertyStatus enum name
            double revenue,
            long bookedNights,
            int totalReservations,
            int cancelledReservations,
            Double avgRating // null si pas de reviews
    ) {
        public double cancellationRate() {
            return totalReservations == 0 ? 0.0
                    : (double) cancelledReservations / totalReservations;
        }
    }
}
