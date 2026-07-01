package com.clenzy.service.agent;

/**
 * Bornes de contexte envoyées au LLM par l'assistant (lever #2 — réduction tokens).
 *
 * <p><b>Pourquoi</b> : l'historique conversationnel et les résultats d'outils étaient
 * envoyés INTÉGRALEMENT et ré-envoyés à chaque itération de la boucle d'outils, sans
 * troncature — le contexte grossissait sans borne (un gros payload JSON de liste/finance
 * répété 4×). On borne ici deux dimensions :</p>
 * <ul>
 *   <li><b>Fenêtre d'historique</b> : au plus {@link #MAX_HISTORY_MESSAGES} messages
 *       (tours user/assistant/tool) transmis au LLM — les plus anciens sont élagués.</li>
 *   <li><b>Taille d'un résultat d'outil</b> : tronqué à {@link #MAX_TOOL_RESULT_CHARS}
 *       caractères pour la copie ENVOYÉE au LLM. La copie PERSISTÉE (et le widget frontend,
 *       hydraté depuis le tool_call de l'assistant) restent complets.</li>
 * </ul>
 *
 * <p>Stateless (constantes + helper pur). Les valeurs sont volontairement généreuses :
 * on coupe la longue traîne, pas le contexte utile récent.</p>
 */
public final class ContextBudget {

    private ContextBudget() {}

    /**
     * Nombre max de messages d'historique transmis au LLM (≈ 8-12 tours). Au-delà,
     * on ne garde que les plus récents (fenêtre glissante) — cf. {@code ConversationHistoryMapper}.
     */
    public static final int MAX_HISTORY_MESSAGES = 24;

    /**
     * Taille max (caractères) d'UN résultat d'outil envoyé au LLM (~2k tokens). Un gros
     * payload (liste de 200 réservations, bilan détaillé) est résumé par la troncature :
     * le LLM n'a besoin que d'un digest, le rendu riche vient du widget frontend.
     */
    public static final int MAX_TOOL_RESULT_CHARS = 8000;

    /** Tronque un résultat d'outil trop volumineux pour la copie envoyée au LLM. */
    public static String capToolResult(String content) {
        if (content == null) {
            return "";
        }
        if (content.length() <= MAX_TOOL_RESULT_CHARS) {
            return content;
        }
        return content.substring(0, MAX_TOOL_RESULT_CHARS)
                + "\n…[résultat tronqué pour le contexte — " + content.length()
                + " caractères au total ; le détail complet est affiché dans le widget]";
    }
}
