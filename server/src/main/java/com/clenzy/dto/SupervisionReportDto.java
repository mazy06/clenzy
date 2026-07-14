package com.clenzy.dto;

/**
 * Bilan de valeur de la constellation sur une fenêtre glissante (org-scopé) :
 * ce que les agents ont fait, le taux d'acceptation des suggestions, et une
 * estimation du temps opérateur épargné (ROI). Alimente l'écran de reporting.
 */
public record SupervisionReportDto(
        int windowDays,
        long autoActions,                 // actions auto journalisées sur la fenêtre
        long suggestionsApplied,          // suggestions appliquées (appliedAt dans la fenêtre)
        long suggestionsDismissed,        // suggestions rejetées (créées dans la fenêtre, statut DISMISSED)
        long suggestionsPending,          // suggestions en attente actuellement
        double acceptanceRate,            // applied / (applied + dismissed), 0 si aucune décision
        long estimatedTimeSavedMinutes,   // ROI (heuristique documentée)
        String estimatedTimeSaved,        // même valeur, format humain ("≈ 4 h 30")
        java.util.List<SupervisionTypeAcceptanceDto> acceptanceByType) {} // acceptation PAR TYPE (Vague 1)
