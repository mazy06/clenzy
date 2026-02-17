package com.clenzy.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Rapport de verification de conformite d'un template de document.
 * Stocke le resultat de la validation (tags manquants, mentions absentes, score).
 */
@Entity
@Table(name = "template_compliance_reports")
public class TemplateComplianceReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id", nullable = false)
    private DocumentTemplate template;

    @Column(nullable = false)
    private boolean compliant;

    @Column(name = "checked_at", nullable = false)
    private LocalDateTime checkedAt = LocalDateTime.now();

    @Column(name = "checked_by", length = 255)
    private String checkedBy;

    /** Tags manquants (JSON array ou comma-separated) */
    @Column(name = "missing_tags", columnDefinition = "TEXT")
    private String missingTags;

    /** Mentions legales manquantes (JSON array ou comma-separated) */
    @Column(name = "missing_mentions", columnDefinition = "TEXT")
    private String missingMentions;

    /** Avertissements non-bloquants */
    @Column(columnDefinition = "TEXT")
    private String warnings;

    /** Score de conformite 0-100 */
    @Column
    private Integer score = 0;

    public TemplateComplianceReport() {}

    // ─── Getters / Setters ────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public DocumentTemplate getTemplate() { return template; }
    public void setTemplate(DocumentTemplate template) { this.template = template; }

    /** Convenience getter pour l'ID du template. */
    public Long getTemplateId() {
        return template != null ? template.getId() : null;
    }

    public boolean isCompliant() { return compliant; }
    public void setCompliant(boolean compliant) { this.compliant = compliant; }

    public LocalDateTime getCheckedAt() { return checkedAt; }
    public void setCheckedAt(LocalDateTime checkedAt) { this.checkedAt = checkedAt; }

    public String getCheckedBy() { return checkedBy; }
    public void setCheckedBy(String checkedBy) { this.checkedBy = checkedBy; }

    public String getMissingTags() { return missingTags; }
    public void setMissingTags(String missingTags) { this.missingTags = missingTags; }

    public String getMissingMentions() { return missingMentions; }
    public void setMissingMentions(String missingMentions) { this.missingMentions = missingMentions; }

    public String getWarnings() { return warnings; }
    public void setWarnings(String warnings) { this.warnings = warnings; }

    public Integer getScore() { return score; }
    public void setScore(Integer score) { this.score = score; }
}
