package com.clenzy.repository;

import com.clenzy.model.KbChunk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface KbChunkRepository extends JpaRepository<KbChunk, Long> {

    /** Chunks orphelins (ingestion pendant une panne embeddings) — a re-embedder. */
    long countByEmbeddingIsNull();

    /** Batch de chunks orphelins pour le job de re-embedding. */
    List<KbChunk> findByEmbeddingIsNull(org.springframework.data.domain.Pageable pageable);

    /** Supprime tous les chunks d'un doc — utilise au reindex/upsert. */
    @Modifying
    @Query("DELETE FROM KbChunk c WHERE c.documentId = :documentId")
    int deleteByDocumentId(@Param("documentId") Long documentId);

    /**
     * Recherche par similarite cosine via pgvector (operator {@code <=>}).
     * Filtre par scope org : on retourne uniquement les chunks dont le doc est
     * soit global (organization_id NULL), soit appartient a l'org demandee.
     *
     * <p>Native query — retourne une {@code List<Object[]>} :
     * {@code [chunkId, content, sourcePath, title, documentId, cosineDistance]}.
     * Le caller transforme en DTO. La distance cosine est dans [0,2] ; on convertit
     * en relevance [0,1] via {@code 1 - distance/2}.</p>
     */
    @Query(value = """
            SELECT c.id, c.content, d.source_path, d.title, d.id AS document_id,
                   (c.embedding <=> CAST(:queryEmbedding AS vector)) AS distance
            FROM kb_chunk c
            JOIN kb_document d ON d.id = c.document_id
            WHERE c.embedding IS NOT NULL
              AND (d.organization_id IS NULL OR d.organization_id = :orgId)
              AND (d.organization_id IS NOT NULL OR d.lang = :lang)
            ORDER BY c.embedding <=> CAST(:queryEmbedding AS vector)
            LIMIT :topK
            """, nativeQuery = true)
    List<Object[]> searchByCosineSimilarity(@Param("queryEmbedding") String queryEmbedding,
                                              @Param("orgId") Long orgId,
                                              @Param("lang") String lang,
                                              @Param("topK") int topK);

    /**
     * Volet lexical de la recherche hybride : full-text Postgres sur la colonne
     * generee {@code content_tsv}, classee par {@code ts_rank_cd}. Rattrape les
     * requetes par termes exacts que le dense retrieval rate (« taxe de sejour »,
     * « iCal », noms de features).
     *
     * <p><b>Config linguistique alignee sur la langue de l'utilisateur</b>
     * ({@code :lang} : fr → french, en → english, ar → simple), la meme que celle
     * utilisee pour generer la tsvector des chunks de cette langue (0348) — le
     * stemming query/document est coherent par langue.</p>
     *
     * <p>Meme shape de retour que {@link #searchByCosineSimilarity} — la derniere
     * colonne est la distance cosine du chunk (nullable si embedding absent), pour
     * que la fusion RRF donne une relevance homogene aux deux volets.</p>
     */
    @Query(value = """
            SELECT c.id, c.content, d.source_path, d.title, d.id AS document_id,
                   (c.embedding <=> CAST(:queryEmbedding AS vector)) AS distance
            FROM kb_chunk c
            JOIN kb_document d ON d.id = c.document_id,
                 websearch_to_tsquery(
                     CASE :lang WHEN 'en' THEN 'english'::regconfig
                                WHEN 'ar' THEN 'simple'::regconfig
                                ELSE 'french'::regconfig END,
                     :query) AS ts_query
            WHERE c.content_tsv @@ ts_query
              AND (d.organization_id IS NULL OR d.organization_id = :orgId)
              AND (d.organization_id IS NOT NULL OR d.lang = :lang)
            ORDER BY ts_rank_cd(c.content_tsv, ts_query) DESC
            LIMIT :topK
            """, nativeQuery = true)
    List<Object[]> searchByTextRank(@Param("query") String query,
                                      @Param("queryEmbedding") String queryEmbedding,
                                      @Param("orgId") Long orgId,
                                      @Param("lang") String lang,
                                      @Param("topK") int topK);
}
