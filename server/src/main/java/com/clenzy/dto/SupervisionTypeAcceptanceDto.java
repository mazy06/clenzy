package com.clenzy.dto;

/**
 * Acceptation PAR TYPE d'action (Vague 1 autonomie) sur la fenêtre du rapport :
 * combien de cartes de ce type ont été appliquées / rejetées / restent en attente,
 * et le taux d'acceptation (applied / (applied + dismissed)). Aide à la décision
 * d'activation des toggles d'auto-application (cible ≥ ~95 % sur ≥ 20 décisions).
 */
public record SupervisionTypeAcceptanceDto(
        String moduleKey,
        String actionType,
        long applied,
        long dismissed,
        long pending,
        double acceptanceRate) {}
