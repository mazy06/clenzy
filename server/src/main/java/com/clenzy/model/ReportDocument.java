package com.clenzy.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Un rapport d'analyse genere, fige et tracable.
 *
 * <p><b>Le snapshot est la piece maitresse.</b> Il porte tous les chiffres du
 * document au moment de sa generation ; le rendu — ecran ou PDF — ne fait que
 * le traduire. Regenerer un rapport a six mois d'intervalle redonne donc
 * exactement le meme document, meme si les donnees sous-jacentes ont bouge.
 * C'est la meme exigence que pour une facture.</p>
 *
 * <p>Le numero suit le document a travers ses versions : {@code R-2026-0042}
 * en version 3 reste le meme rapport, corrige. Un envoi fige la version.</p>
 */
@Entity
@Table(name = "report_documents", indexes = {
    @Index(name = "idx_report_document_org", columnList = "organization_id"),
    @Index(name = "idx_report_document_status", columnList = "organization_id, status"),
    @Index(name = "idx_report_document_recipient", columnList = "organization_id, recipient_user_id")
})
public class ReportDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    /** Numero stable, partage par toutes les versions du meme rapport. */
    @Size(max = 32)
    @Column(name = "document_number", nullable = false, length = 32)
    private String documentNumber;

    @Column(name = "version", nullable = false)
    private int version = 1;

    @Enumerated(EnumType.STRING)
    @Column(name = "profile", nullable = false, length = 16)
    private com.clenzy.dto.report.ReportProfile profile;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private ReportDocumentStatus status = ReportDocumentStatus.DRAFT;

    @Size(max = 200)
    @Column(name = "title", nullable = false, length = 200)
    private String title;

    /**
     * Le destinataire quand c'est un utilisateur connu (proprietaire).
     *
     * <p>Nul pour un rapport interne ou un dossier prospect : ceux-la n'ont pas
     * de compte a rattacher.</p>
     */
    @Column(name = "recipient_user_id")
    private Long recipientUserId;

    @Size(max = 200)
    @Column(name = "recipient_name", length = 200)
    private String recipientName;

    @Size(max = 320)
    @Column(name = "recipient_email", length = 320)
    private String recipientEmail;

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    /** Instant d'arret des donnees — ce que le document affiche en pied de page. */
    @Column(name = "data_as_of", nullable = false)
    private Instant dataAsOf;

    /** Le snapshot chiffre complet, serialise. Source unique des trois rendus. */
    @Column(name = "snapshot_json", nullable = false, columnDefinition = "text")
    private String snapshotJson;

    /** Le commentaire de l'agent, serialise. Nul si le rapport a ete genere sans. */
    @Column(name = "narrative_json", columnDefinition = "text")
    private String narrativeJson;

    /**
     * Empreinte du snapshot.
     *
     * <p>Deux usages : detecter qu'une regeneration ne change rien (inutile de
     * refacturer un commentaire IA identique), et prouver qu'un document
     * archive n'a pas ete retouche.</p>
     */
    @Size(max = 64)
    @Column(name = "snapshot_hash", nullable = false, length = 64)
    private String snapshotHash;

    @Size(max = 64)
    @Column(name = "created_by_keycloak_id", length = 64)
    private String createdByKeycloakId;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Size(max = 64)
    @Column(name = "reviewed_by_keycloak_id", length = 64)
    private String reviewedByKeycloakId;

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getDocumentNumber() { return documentNumber; }
    public void setDocumentNumber(String documentNumber) { this.documentNumber = documentNumber; }

    public int getVersion() { return version; }
    public void setVersion(int version) { this.version = version; }

    public com.clenzy.dto.report.ReportProfile getProfile() { return profile; }
    public void setProfile(com.clenzy.dto.report.ReportProfile profile) { this.profile = profile; }

    public ReportDocumentStatus getStatus() { return status; }
    public void setStatus(ReportDocumentStatus status) { this.status = status; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public Long getRecipientUserId() { return recipientUserId; }
    public void setRecipientUserId(Long recipientUserId) { this.recipientUserId = recipientUserId; }

    public String getRecipientName() { return recipientName; }
    public void setRecipientName(String recipientName) { this.recipientName = recipientName; }

    public String getRecipientEmail() { return recipientEmail; }
    public void setRecipientEmail(String recipientEmail) { this.recipientEmail = recipientEmail; }

    public LocalDate getPeriodStart() { return periodStart; }
    public void setPeriodStart(LocalDate periodStart) { this.periodStart = periodStart; }

    public LocalDate getPeriodEnd() { return periodEnd; }
    public void setPeriodEnd(LocalDate periodEnd) { this.periodEnd = periodEnd; }

    public Instant getDataAsOf() { return dataAsOf; }
    public void setDataAsOf(Instant dataAsOf) { this.dataAsOf = dataAsOf; }

    public String getSnapshotJson() { return snapshotJson; }
    public void setSnapshotJson(String snapshotJson) { this.snapshotJson = snapshotJson; }

    public String getNarrativeJson() { return narrativeJson; }
    public void setNarrativeJson(String narrativeJson) { this.narrativeJson = narrativeJson; }

    public String getSnapshotHash() { return snapshotHash; }
    public void setSnapshotHash(String snapshotHash) { this.snapshotHash = snapshotHash; }

    public String getCreatedByKeycloakId() { return createdByKeycloakId; }
    public void setCreatedByKeycloakId(String createdByKeycloakId) { this.createdByKeycloakId = createdByKeycloakId; }

    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }

    public String getReviewedByKeycloakId() { return reviewedByKeycloakId; }
    public void setReviewedByKeycloakId(String reviewedByKeycloakId) { this.reviewedByKeycloakId = reviewedByKeycloakId; }

    public LocalDateTime getSentAt() { return sentAt; }
    public void setSentAt(LocalDateTime sentAt) { this.sentAt = sentAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
