package com.clenzy.dto;

/**
 * Règle d'auto-application d'un type d'action de la constellation (Vague 1).
 *
 * <p>{@code level} et {@code moduleCeiling} sont au format « wire » lowercase
 * ({@code suggest} | {@code notify} | {@code full}), comme la config des
 * modules. {@code moduleCeiling} est calculé côté serveur (plafond de l'agent —
 * lecture seule, l'UI l'affiche quand il bride la règle) ; en écriture (PUT),
 * seuls {@code actionType}, {@code enabled}, {@code level} et {@code envelope}
 * sont pris en compte.</p>
 */
public record SupervisionAutoRuleDto(
        String actionType,
        String moduleKey,      // module (agent) qui porte ce type — lecture seule
        boolean enabled,
        String level,          // 'notify' | 'full'
        String envelope,       // JSON éditable, null = défauts serveur
        String moduleCeiling) {} // plafond du module ('suggest'|'notify'|'full') — lecture seule
