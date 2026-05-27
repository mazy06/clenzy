package com.clenzy.repository;

import com.clenzy.model.KbChunk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface KbChunkRepository extends JpaRepository<KbChunk, Long> {

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
            ORDER BY c.embedding <=> CAST(:queryEmbedding AS vector)
            LIMIT :topK
            """, nativeQuery = true)
    List<Object[]> searchByCosineSimilarity(@Param("queryEmbedding") String queryEmbedding,
                                              @Param("orgId") Long orgId,
                                              @Param("topK") int topK);
}
