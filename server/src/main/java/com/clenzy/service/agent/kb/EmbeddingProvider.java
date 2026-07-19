package com.clenzy.service.agent.kb;

import java.util.List;

/**
 * Provider d'embeddings pour le RAG. Deux implementations :
 * <ul>
 *   <li>{@code VoyageEmbeddingProvider} (defaut) : voyage-3-large, 1024d natif</li>
 *   <li>{@code OpenAIEmbeddingProvider} : text-embedding-3-large avec param
 *       {@code dimensions=1024} pour matcher la table {@code kb_chunk.embedding}</li>
 * </ul>
 *
 * <p><b>Credential-stateless</b> : le provider ne porte AUCUNE cle/modele/baseUrl propre.
 * {@link EmbeddingService} resout la cible ({@link EmbeddingTarget}) depuis la config DB
 * (feature {@code EMBEDDINGS}, source de verite unique — plus de variable d'environnement)
 * et la passe a chaque appel. Le provider concret n'apporte que le format d'API (Voyage/OpenAI).</p>
 */
public interface EmbeddingProvider {

    /**
     * Nature du texte a embedder. Les modeles asymetriques (Voyage) optimisent
     * differemment les questions ({@code QUERY}) et les contenus indexes
     * ({@code DOCUMENT}) — melanger les deux degrade la qualite du retrieval.
     */
    enum InputKind { QUERY, DOCUMENT }

    /**
     * Cible d'embedding resolue depuis la config DB : cle API, modele, baseUrl, dimension.
     * La {@code dimension} doit valoir 1024 (= schema {@code kb_chunk.embedding}).
     */
    record EmbeddingTarget(String apiKey, String model, String baseUrl, int dimensions) {}

    /**
     * Genere l'embedding d'un texte unique. Retourne un tableau float[target.dimensions()].
     *
     * @throws EmbeddingException si la cle manque ou si l'API echoue (reseau, quota, etc.)
     */
    float[] embed(String text, EmbeddingTarget target, InputKind kind);

    /**
     * Batch embed : utilise pour l'ingestion (1 appel HTTP pour N chunks).
     * Les implementations decoupent en sous-batches si l'API a une limite.
     */
    List<float[]> embedBatch(List<String> texts, EmbeddingTarget target, InputKind kind);

    /** Nom du provider (= valeur {@code PlatformAiModel.provider} : "voyage" ou "openai"). */
    String name();

    /** Exception non-checked levee par les providers. */
    class EmbeddingException extends RuntimeException {
        public EmbeddingException(String message) { super(message); }
        public EmbeddingException(String message, Throwable cause) { super(message, cause); }
    }
}
