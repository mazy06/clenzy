package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

/**
 * Tag detecte automatiquement dans un template de document.
 * Chaque tag est classifie par categorie (CLIENT, PROPERTY, etc.) et par type (SIMPLE, LIST, DATE, etc.).
 */
@Entity
@Table(name = "document_template_tags",
       uniqueConstraints = @UniqueConstraint(columnNames = {"template_id", "tag_name"}))
public class DocumentTemplateTag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id", nullable = false)
    private DocumentTemplate template;

    @Column(name = "tag_name", nullable = false, length = 200)
    private String tagName;

    @Enumerated(EnumType.STRING)
    @Column(name = "tag_category", nullable = false, length = 50)
    private TagCategory tagCategory;

    @Column(name = "data_source", length = 200)
    private String dataSource;

    @Column(length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "tag_type", nullable = false, length = 20)
    private TagType tagType = TagType.SIMPLE;

    @Column(nullable = false)
    private Boolean required = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    // ─── Getters / Setters ────────────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public DocumentTemplate getTemplate() { return template; }
    public void setTemplate(DocumentTemplate template) { this.template = template; }

    public String getTagName() { return tagName; }
    public void setTagName(String tagName) { this.tagName = tagName; }

    public TagCategory getTagCategory() { return tagCategory; }
    public void setTagCategory(TagCategory tagCategory) { this.tagCategory = tagCategory; }

    public String getDataSource() { return dataSource; }
    public void setDataSource(String dataSource) { this.dataSource = dataSource; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public TagType getTagType() { return tagType; }
    public void setTagType(TagType tagType) { this.tagType = tagType; }

    public Boolean getRequired() { return required; }
    public void setRequired(Boolean required) { this.required = required; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
