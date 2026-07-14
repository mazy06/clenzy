package com.clenzy.dto;

/**
 * Règle d'auto-application d'un type d'action de la constellation (Vagues 1-2).
 *
 * <p>{@code level}, {@code moduleCeiling} et {@code maxLevel} sont au format
 * « wire » lowercase ({@code suggest} | {@code notify} | {@code full}), comme la
 * config des modules. {@code moduleCeiling} (plafond de l'agent) et
 * {@code maxLevel} (niveau maximum du type au catalogue serveur — ex. NOTIFY
 * pour les cautions et le blocage calendrier, jamais silencieux) sont calculés
 * côté serveur, lecture seule ; en écriture (PUT), seuls {@code actionType},
 * {@code enabled}, {@code level} et {@code envelope} sont pris en compte (le
 * niveau est de toute façon borné par le serveur ET par le gate).</p>
 */
public record SupervisionAutoRuleDto(
        String actionType,
        String moduleKey,      // module (agent) qui porte ce type — lecture seule
        boolean enabled,
        String level,          // 'notify' | 'full'
        String envelope,       // JSON éditable, null = défauts serveur
        String moduleCeiling,  // plafond du module ('suggest'|'notify'|'full') — lecture seule
        String maxLevel,       // niveau MAX du type au catalogue ('notify'|'full') — lecture seule
        String suggestedAt,    // suggestion « automatiser ? » active (ISO) ou null — lecture seule (V3)
        long consecutiveApprovals) {} // approbations humaines consécutives (chip) — lecture seule (V3)
