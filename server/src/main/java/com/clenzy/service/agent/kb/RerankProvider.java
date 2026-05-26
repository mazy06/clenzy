package com.clenzy.service.agent.kb;

import java.util.List;

/**
 * Strategie de re-ranking : prend une liste de documents pre-recuperes
 * (typiquement par recherche cosine, moins precise) et les reordonne selon
 * leur pertinence reelle pour une query donnee.
 *
 * <p>Modele SOLID :
 * <ul>
 *   <li>Strategy : impls multiples (Voyage, Cohere, NoOp...) interchangeables</li>
 *   <li>Open/Closed : ajouter un provider = nouveau bean, pas de modif des callers</li>
 *   <li>Dependency Inversion : KbSearchService depend de l'abstraction, pas du concrete</li>
 * </ul>
 *
 * <p>Returns des indices originaux ordonnes par relevance descendante (le caller
 * mappe vers ses DTOs). Cette signature permet a un provider de re-ranker sans
 * connaitre le type concret des documents.</p>
 */
public interface RerankProvider {

    /**
     * Reordonne {@code documents} par pertinence vis-a-vis de {@code query}.
     *
     * @param query     question / requete
     * @param documents textes des documents (lus dans l'ordre fourni)
     * @param topK      nombre de resultats a retourner (≤ documents.size())
     * @return liste d'indices (referencant {@code documents}) ordonnes par
     *         relevance DESC, taille = min(topK, documents.size())
     */
    List<Integer> rerank(String query, List<String> documents, int topK);

    /** Nom du provider — utilise pour {@code clenzy.ai.rerank.provider}. */
    String name();

    /** Indique si le provider est exploitable (cle API configuree, etc.). */
    default boolean isAvailable() {
        return true;
    }

    /** Exception non-checked levee par les providers en cas d'echec. */
    class RerankException extends RuntimeException {
        public RerankException(String message) { super(message); }
        public RerankException(String message, Throwable cause) { super(message, cause); }
    }
}
