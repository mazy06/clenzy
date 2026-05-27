package com.clenzy.service.agent.prompt;

/**
 * Preset de composition pour le system prompt.
 *
 * <p>Determine quelles {@link PromptSection} sont actives. Permet de partager
 * les sections communes (role, rules, anti-hallucination) entre cas d'usage
 * tout en variant les sections specifiques (briefing-task vs catalogue tools).</p>
 *
 * <p>OCP : ajouter un nouveau preset = ajouter une valeur + filtre dans les
 * sections concernees. Aucune modification de {@link SystemPromptComposer}.</p>
 */
public enum PromptPreset {
    /** Chat conversationnel standard (assistant). Toutes sections actives. */
    CHAT,

    /** Briefing matinal quotidien. Sections : role, rules, anti-hallu, daily-task. */
    BRIEFING_DAILY,

    /** Weekly review du dimanche. Sections : role, rules, anti-hallu, weekly-task. */
    BRIEFING_WEEKLY,

    /** Verification d'alertes critiques uniquement. Minimal : role, rules, alerts-task. */
    BRIEFING_ALERTS
}
