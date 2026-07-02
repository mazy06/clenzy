package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.time.LocalDateTime;

/**
 * Conversation de l'assistant IA d'un utilisateur dans une organisation.
 *
 * <p>Multi-tenant via {@code organizationFilter} (Hibernate Filter). Un user
 * ne voit que ses propres conversations (filtre {@code keycloak_id} au niveau
 * service), avec defense en profondeur cote BDD via le filtre Hibernate.</p>
 *
 * <p>{@code title} est genere automatiquement a partir du premier message
 * apres la 1ere reponse du LLM. {@code archived_at} permet de soft-delete sans
 * casser les references depuis les messages.</p>
 */
@Entity
@Table(name = "assistant_conversation")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class AssistantConversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "keycloak_id", nullable = false, length = 255)
    private String keycloakId;

    @Column(length = 255)
    private String title;

    @Column(length = 120)
    private String model;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Column(name = "archived_at")
    private LocalDateTime archivedAt;

    /** Résumé structuré compact du début de conversation (X6) — hors fenêtre glissante. */
    @Column(name = "rolling_summary", columnDefinition = "TEXT")
    private String rollingSummary;

    /** Nombre de messages les plus anciens déjà couverts par {@link #rollingSummary}. */
    @Column(name = "summary_covers_count", nullable = false)
    private int summaryCoversCount = 0;

    public AssistantConversation() {}

    public AssistantConversation(Long organizationId, String keycloakId) {
        this.organizationId = organizationId;
        this.keycloakId = keycloakId;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public String getKeycloakId() { return keycloakId; }
    public void setKeycloakId(String keycloakId) { this.keycloakId = keycloakId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public LocalDateTime getArchivedAt() { return archivedAt; }
    public void setArchivedAt(LocalDateTime archivedAt) { this.archivedAt = archivedAt; }
    public String getRollingSummary() { return rollingSummary; }
    public void setRollingSummary(String rollingSummary) { this.rollingSummary = rollingSummary; }
    public int getSummaryCoversCount() { return summaryCoversCount; }
    public void setSummaryCoversCount(int summaryCoversCount) { this.summaryCoversCount = summaryCoversCount; }
}
