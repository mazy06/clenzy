package com.clenzy.dto;

/**
 * Automatisation qui vit HORS du hub (câblée dans le code ou un autre mécanisme :
 * planificateur, flux serrure, flux paiement). Exposée en LECTURE SEULE dans
 * l'écran d'automatisation pour donner une vue exhaustive de ce qui est
 * automatisé et de son état réel — le statut est calculé depuis l'état effectif
 * (flags/config de l'org), jamais codé en dur.
 *
 * @param key         identifiant stable
 * @param label       nom lisible
 * @param description ce que fait l'automatisation
 * @param triggerLabel quand elle se déclenche
 * @param actionLabel  ce qu'elle produit
 * @param effective    true si le chemin est actif pour l'org (non désactivé)
 * @param status       code stable pour l'affichage : ACTIVE | INACTIVE | TRANSACTIONAL | OPT_IN
 * @param statusLabel  libellé lisible du statut
 * @param mechanism    où elle vit (ex. « Planificateur », « Flux serrure »)
 */
public record SystemAutomationDto(
    String key,
    String label,
    String description,
    String triggerLabel,
    String actionLabel,
    boolean effective,
    String status,
    String statusLabel,
    String mechanism
) {}
