package com.clenzy.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Document indexe dans la knowledge base RAG de l'assistant.
 *
 * <p>{@link #organizationId} : NULL = doc globale Clenzy (README, primer, articles
 * produit accessibles a toutes les orgs) ; non-NULL = doc specifique a une org
 * cliente (notes internes, procedures custom). Le tool {@code search_knowledge_base}
 * filtre cote SQL avec {@code WHERE organization_id IS NULL OR organization_id = :orgId}.</p>
 *
 * <p>Pas de filtre Hibernate ici : le multi-tenant est applique a la main par les
 * requetes natives utilisees pour la recherche vectorielle (le filtre @Filter ne
 * peut pas etre injecte dans une native query).</p>
 */
@Entity
@Table(name = "kb_document",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_kb_document_source_org",
                columnNames = {"source_path", "organization_id"}))
public class KbDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "source_path", nullable = false, length = 500)
    private String sourcePath;

    @Column(length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(length = 10)
    private String lang = "fr";

    /** NULL = document Clenzy global ; non-NULL = doc specifique a une org. */
    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public KbDocument() {}

    public KbDocument(String sourcePath, String title, String content, String lang, Long organizationId) {
        this.sourcePath = sourcePath;
        this.title = title;
        this.content = content;
        if (lang != null) this.lang = lang;
        this.organizationId = organizationId;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getSourcePath() { return sourcePath; }
    public void setSourcePath(String sourcePath) { this.sourcePath = sourcePath; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getLang() { return lang; }
    public void setLang(String lang) { this.lang = lang; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
