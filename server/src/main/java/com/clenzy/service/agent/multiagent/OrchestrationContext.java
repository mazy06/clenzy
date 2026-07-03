package com.clenzy.service.agent.multiagent;

import com.clenzy.model.AssistantMemory;
import com.clenzy.service.agent.kb.KbSearchService.KbSearchHit;

import java.util.List;
import java.util.Objects;

/**
 * Contexte enrichi transmis a {@link OrchestratorAgent#orchestrate(List,
 * com.clenzy.service.agent.AgentContext, OrchestrationContext)} pour donner
 * au flow multi-agent acces aux memes ressources que le mono-agent.
 *
 * <p>Pre-charges par l'AgentOrchestrator UNE FOIS par tour user (avant la
 * decision multi vs mono), puis propages a l'orchestrator + aux specialists
 * via {@link SpecialistRequest}. Permet :</p>
 * <ul>
 *   <li><b>Memory long-terme</b> (preferences, faits, objectifs, projets) →
 *       reponses personnalisees ("tu m'avais dit que tu prefere les rapports
 *       en EUR")</li>
 *   <li><b>RAG knowledge base</b> (snippets doc relevants pour la query) →
 *       citations precises + anti-hallucination</li>
 * </ul>
 *
 * <p>Les listes sont copiees defensivement (record-canonical) et garanties
 * non-null. Vides = "rien a injecter", l'agent ne degrade pas.</p>
 *
 * @param memories   memoires de l'utilisateur applicables (par similarite
 *                   sur la query si pertinent, sinon recency). Jamais null.
 * @param kbHits     snippets doc au-dessus du seuil de relevance pour la
 *                   query courante. Jamais null.
 */
public record OrchestrationContext(
        List<AssistantMemory> memories,
        List<KbSearchHit> kbHits,
        String blackboardDigest
) {
    public OrchestrationContext {
        memories = (memories == null) ? List.of() : List.copyOf(memories);
        kbHits = (kbHits == null) ? List.of() : List.copyOf(kbHits);
    }

    /** Constructeur historique (sans blackboard) — l'immense majorite des usages. */
    public OrchestrationContext(List<AssistantMemory> memories, List<KbSearchHit> kbHits) {
        this(memories, kbHits, null);
    }

    /**
     * Copie avec le digest blackboard (L1, architecture C v1) : constats des
     * delegations PRECEDENTES du meme run, injectes mecaniquement dans le
     * prompt du specialist suivant — l'orchestrateur n'a plus a les recopier
     * dans ses mandats. Null/blank = section absente.
     */
    public OrchestrationContext withBlackboardDigest(String digest) {
        return new OrchestrationContext(memories, kbHits, digest);
    }

    /** Contexte vide : aucune memoire ni hit RAG (degradation gracieuse). */
    public static OrchestrationContext empty() {
        return new OrchestrationContext(List.of(), List.of());
    }

    /** Convenience : true si on a au moins une memoire ou un hit RAG. */
    public boolean hasContent() {
        return !memories.isEmpty() || !kbHits.isEmpty();
    }
}
