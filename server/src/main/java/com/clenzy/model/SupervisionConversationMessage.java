package com.clenzy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * Un tour de la conversation opérateur ↔ orchestrateur de la constellation (B7),
 * persisté pour l'historique/recherche. Org + logement scopé. {@code role} =
 * {@code "operator"} ou {@code "orchestrator"}.
 */
@Entity
@Table(name = "supervision_conversation_message", indexes = {
        @Index(name = "idx_supervision_conv_org_prop_created",
                columnList = "organization_id, property_id, created_at")
})
public class SupervisionConversationMessage {

    public static final String ROLE_OPERATOR = "operator";
    public static final String ROLE_ORCHESTRATOR = "orchestrator";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id")
    private Long propertyId;

    @Column(name = "keycloak_user_id")
    private String keycloakUserId;

    @Column(name = "role", nullable = false, length = 20)
    private String role;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private Instant createdAt;

    public SupervisionConversationMessage() {}

    public SupervisionConversationMessage(Long organizationId, Long propertyId, String keycloakUserId,
                                          String role, String content) {
        this.organizationId = organizationId;
        this.propertyId = propertyId;
        this.keycloakUserId = keycloakUserId;
        this.role = role;
        this.content = content;
    }

    public Long getId() { return id; }
    public Long getOrganizationId() { return organizationId; }
    public Long getPropertyId() { return propertyId; }
    public String getKeycloakUserId() { return keycloakUserId; }
    public String getRole() { return role; }
    public String getContent() { return content; }
    public Instant getCreatedAt() { return createdAt; }
}
