package com.clenzy.dto;

/**
 * Résultat d'un scan manuel de la constellation (Phase 3-B.2 étape 1).
 *
 * @param status      "ok" | "disabled" (feature OFF) | "paused"
 * @param activities  nb d'actions réelles observées et journalisées pendant le scan
 * @param suggestions nb d'actions sensibles proposées (en attente de validation)
 * @param reply       synthèse texte de l'orchestrateur (peut être vide)
 */
public record SupervisionScanResultDto(
        String status,
        int activities,
        int suggestions,
        String reply
) {
}
