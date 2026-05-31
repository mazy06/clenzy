package com.clenzy.service.agent.prompt;

/**
 * Compose le system prompt final a partir d'un ensemble de {@link PromptSection}.
 *
 * <p>Interface (DIP) : {@code AgentOrchestrator} et {@code BriefingComposer}
 * dependent de cette abstraction, pas de l'implementation concrete. Permet
 * de mocker en tests et d'experimenter une seconde implementation (ex:
 * version compactee, version anglaise, etc.) sans toucher les callers.</p>
 */
public interface SystemPromptComposer {

    /**
     * Compose le prompt complet en concatenant toutes les sections applicables
     * triees par {@link PromptSection#order()}.
     *
     * @param context contexte immutable (jamais null)
     * @return prompt complet, peut etre vide si aucune section ne s'applique
     */
    String compose(PromptContext context);

    /**
     * Variante scindee pour le prompt caching : separe les sections stables
     * ({@link PromptSection#cacheable()}) du contenu volatil (memoire, RAG,
     * contexte). Le {@link ComposedSystemPrompt#full()} reconstruit est
     * equivalent en contenu a {@link #compose(PromptContext)} (l'ordre interne
     * place le groupe stable d'abord, le groupe volatil ensuite).
     *
     * @param context contexte immutable (jamais null)
     * @return prompt scinde (les deux parties peuvent etre vides)
     */
    ComposedSystemPrompt composeSegmented(PromptContext context);
}
