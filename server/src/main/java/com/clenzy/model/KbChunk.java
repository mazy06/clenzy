package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.ColumnTransformer;

import java.time.LocalDateTime;

/**
 * Chunk d'un document de la knowledge base — ~500 tokens, avec son embedding
 * vector(1024) genere par {@link com.clenzy.service.agent.kb.EmbeddingProvider}.
 *
 * <p><b>Strategie de mapping</b> : la colonne {@code embedding} est de type
 * {@code vector(1024)} cote Postgres. Hibernate ne sait pas mapper ce type
 * nativement, donc on l'expose en Java comme {@link String} (la representation
 * texte pgvector est {@code "[0.1, 0.2, ..., 0.9]"}). Le {@link ColumnTransformer}
 * caste explicitement en {@code vector} a l'insert/update.</p>
 *
 * <p>Pour la recherche, on utilise des native queries qui parlent en {@code vector}
 * et exposent la distance cosine via l'operateur {@code <=>}.</p>
 */
@Entity
@Table(name = "kb_chunk",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_kb_chunk_doc_idx",
                columnNames = {"document_id", "chunk_idx"}))
public class KbChunk {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "document_id", nullable = false)
    private Long documentId;

    @Column(name = "chunk_idx", nullable = false)
    private int chunkIdx;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    /**
     * Representation texte du vecteur pgvector : {@code "[0.123, -0.456, ...]"}.
     * Le {@link ColumnTransformer} fait le cast cote SQL ; Hibernate manipule
     * une String.
     */
    @Column(name = "embedding", columnDefinition = "vector(1024)")
    @ColumnTransformer(write = "?::vector")
    private String embedding;

    /**
     * Langue du document parent (fr/en/ar), denormalisee a l'ingestion : la
     * colonne generee {@link #contentTsv} ne peut pas referencer kb_document.
     */
    @Column(length = 10, nullable = false)
    private String lang = "fr";

    /**
     * Colonne generee par Postgres (migrations 0346/0348) pour la recherche
     * lexicale hybride, avec la config linguistique du chunk (french/english/
     * simple). Mappee ici pour que le schema Hibernate (tests, ddl-auto) reste
     * aligne sur Liquibase — jamais ecrite par l'application.
     */
    @Column(name = "content_tsv", insertable = false, updatable = false,
            columnDefinition = "tsvector GENERATED ALWAYS AS (to_tsvector("
                    + "CASE lang WHEN 'en' THEN 'english'::regconfig "
                    + "WHEN 'ar' THEN 'simple'::regconfig "
                    + "ELSE 'french'::regconfig END, content)) STORED")
    private String contentTsv;

    @Column(name = "token_count")
    private Integer tokenCount;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public KbChunk() {}

    public KbChunk(Long documentId, int chunkIdx, String content,
                     String embedding, Integer tokenCount) {
        this.documentId = documentId;
        this.chunkIdx = chunkIdx;
        this.content = content;
        this.embedding = embedding;
        this.tokenCount = tokenCount;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getDocumentId() { return documentId; }
    public void setDocumentId(Long documentId) { this.documentId = documentId; }
    public int getChunkIdx() { return chunkIdx; }
    public void setChunkIdx(int chunkIdx) { this.chunkIdx = chunkIdx; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getEmbedding() { return embedding; }
    public void setEmbedding(String embedding) { this.embedding = embedding; }
    public Integer getTokenCount() { return tokenCount; }
    public void setTokenCount(Integer tokenCount) { this.tokenCount = tokenCount; }
    public String getLang() { return lang; }
    public void setLang(String lang) { this.lang = lang == null || lang.isBlank() ? "fr" : lang; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
