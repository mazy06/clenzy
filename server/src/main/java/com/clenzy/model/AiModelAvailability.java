package com.clenzy.model;

/**
 * Statut de disponibilité d'un modèle IA configuré, déterminé par un probe
 * proactif (cf. PlatformAiConfigService.recheck* + AiModelAvailabilityScheduler).
 *
 * <p>Permet à l'admin de voir, dans « Models &amp; features », si un modèle est
 * encore servi par son provider — et d'être notifié AVANT que les utilisateurs
 * ne tombent sur une erreur (modèle retiré → 404/410).</p>
 */
public enum AiModelAvailability {
    /** Dernier probe réussi : le modèle répond. */
    AVAILABLE,
    /** Dernier probe en échec : modèle non joignable / retiré (404/410) / clé invalide. */
    UNAVAILABLE,
    /** Jamais vérifié (aucun probe encore exécuté). */
    UNKNOWN
}
