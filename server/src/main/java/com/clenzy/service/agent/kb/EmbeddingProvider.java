package com.clenzy.service.agent.kb;

import java.util.List;

/**
 * Provider d'embeddings pour le RAG. Deux implementations :
 * <ul>
 *   <li>{@code VoyageEmbeddingProvider} (defaut) : voyage-3-lite, 1024d natif</li>
 *   <li>{@code OpenAIEmbeddingProvider} : text-embedding-3-small avec param
 *       {@code dimensions=1024} pour matcher la table {@code kb_chunk.embedding}</li>
 * </ul>
 *
 * <p>Selection via la property {@code clenzy.ai.embeddings.provider=voyage|openai}.
 * La factory {@link EmbeddingService} resout le provider au demarrage.</p>
 */
public interface EmbeddingProvider {

    /**
     * Genere l'embedding d'un texte unique. Retourne un tableau float[1024].
     *
     * @throws EmbeddingException si l'API echoue (reseau, quota, etc.)
     */
    float[] embed(String text);

    /**
     * Batch embed : utilise pour l'ingestion (1 appel HTTP pour N chunks).
     * Les implementations decoupent en sous-batches si l'API a une limite.
     */
    List<float[]> embedBatch(List<String> texts);

    /** Nom du provider — utilise pour {@code clenzy.ai.embeddings.provider}. */
    String name();

    /** Dimension de sortie — doit etre 1024 pour coller au schema BDD. */
    default int dimensions() {
        return 1024;
    }

    /** Exception non-checked levee par les providers. */
    class EmbeddingException extends RuntimeException {
        public EmbeddingException(String message) { super(message); }
        public EmbeddingException(String message, Throwable cause) { super(message, cause); }
    }
}
