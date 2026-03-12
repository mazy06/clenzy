package com.clenzy.dto;

/**
 * DTO pour activer/desactiver une feature IA.
 * Utilise par le panneau Parametres > IA.
 */
public record AiFeatureToggleDto(String feature, boolean enabled) {}
