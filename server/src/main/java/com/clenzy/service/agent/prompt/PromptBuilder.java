package com.clenzy.service.agent.prompt;

import com.clenzy.model.AssistantMemory;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.kb.KbSearchService;

import java.util.List;

/**
 * Facade orientee orchestrator : assemble le {@link PromptContext} et delegue
 * au {@link SystemPromptComposer}.
 *
 * <p><b>Pourquoi cette indirection</b> : decouple l'orchestrator de la
 * mecanique de construction du PromptContext (qui pourrait evoluer). L'API
 * de l'orchestrator reste {@code buildSystemPrompt(...) -> String} simple.</p>
 *
 * <p><b>Decision design</b> : on ne fait PAS de queries DB ici (pas de
 * memoire / RAG fetch). C'est a l'invocateur de les passer pre-charges, pour
 * separer les preoccupations (le builder est synchrone et O(1) hors I/O).</p>
 */
public interface PromptBuilder {

    /**
     * Construit le prompt pour un chat standard, scinde en prefixe stable
     * (cacheable) + suffixe volatil pour le prompt caching Anthropic.
     *
     * @param agentContext   identite + UI hints (jamais null)
     * @param userMessage    dernier message user (null OK pour resume-after-confirmation)
     * @param memories       memoires deja chargees (null tolere -> liste vide)
     * @param kbHits         hits RAG deja filtres par relevance (null tolere -> liste vide)
     * @return prompt scinde pret a etre envoye au LLM (voir {@link ComposedSystemPrompt})
     */
    ComposedSystemPrompt buildChatPrompt(AgentContext agentContext,
                                         String userMessage,
                                         List<AssistantMemory> memories,
                                         List<KbSearchService.KbSearchHit> kbHits);

    /**
     * Construit le prompt pour un briefing (DAILY/WEEKLY/ALERTS).
     *
     * @param agentContext identite (jamais null)
     * @param preset       cas de briefing (BRIEFING_DAILY, BRIEFING_WEEKLY, BRIEFING_ALERTS)
     * @param memories     memoires user (null tolere)
     */
    String buildBriefingPrompt(AgentContext agentContext,
                                 PromptPreset preset,
                                 List<AssistantMemory> memories);
}
