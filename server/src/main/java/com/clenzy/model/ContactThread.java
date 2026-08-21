package com.clenzy.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Fil de discussion de la messagerie de contact, avec N participants.
 *
 * <p>Les echanges un-a-un restent des {@link ContactMessage} sans fil : leur
 * regroupement par interlocuteur se calcule a la volee. Un fil n'existe que
 * lorsque la conversation depasse deux personnes — un devis discute entre
 * l'intervenant, le proprietaire et la conciergerie, par exemple.</p>
 */
@Entity
@Table(name = "contact_threads")
public class ContactThread {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(nullable = false, length = 255)
    private String subject;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ContactMessageCategory category = ContactMessageCategory.GENERAL;

    @Column(name = "created_by_keycloak_id", nullable = false, length = 100)
    private String createdByKeycloakId;

    /** Objet metier a l'origine du fil — evite d'en ouvrir un second. */
    @Column(name = "reference_type", length = 40)
    private String referenceType;

    @Column(name = "reference_id")
    private Long referenceId;

    @Column(name = "last_message_at", nullable = false)
    private LocalDateTime lastMessageAt = LocalDateTime.now();

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }

    public ContactMessageCategory getCategory() { return category; }
    public void setCategory(ContactMessageCategory category) { this.category = category; }

    public String getCreatedByKeycloakId() { return createdByKeycloakId; }
    public void setCreatedByKeycloakId(String createdByKeycloakId) { this.createdByKeycloakId = createdByKeycloakId; }

    public String getReferenceType() { return referenceType; }
    public void setReferenceType(String referenceType) { this.referenceType = referenceType; }

    public Long getReferenceId() { return referenceId; }
    public void setReferenceId(Long referenceId) { this.referenceId = referenceId; }

    public LocalDateTime getLastMessageAt() { return lastMessageAt; }
    public void setLastMessageAt(LocalDateTime lastMessageAt) { this.lastMessageAt = lastMessageAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
