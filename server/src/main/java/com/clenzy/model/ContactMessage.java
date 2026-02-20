package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Table(name = "contact_messages")
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class ContactMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "sender_keycloak_id", nullable = false, length = 100)
    private String senderKeycloakId;

    @Column(name = "sender_first_name", nullable = false, length = 100)
    private String senderFirstName;

    @Column(name = "sender_last_name", nullable = false, length = 100)
    private String senderLastName;

    @Column(name = "sender_email", nullable = false, length = 255)
    private String senderEmail;

    @Column(name = "recipient_keycloak_id", nullable = false, length = 100)
    private String recipientKeycloakId;

    @Column(name = "recipient_first_name", nullable = false, length = 100)
    private String recipientFirstName;

    @Column(name = "recipient_last_name", nullable = false, length = 100)
    private String recipientLastName;

    @Column(name = "recipient_email", nullable = false, length = 255)
    private String recipientEmail;

    @Column(nullable = false, length = 255)
    private String subject;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ContactMessagePriority priority = ContactMessagePriority.MEDIUM;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ContactMessageCategory category = ContactMessageCategory.GENERAL;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ContactMessageStatus status = ContactMessageStatus.SENT;

    @Column(name = "is_archived", nullable = false)
    private boolean archived;

    @Column(name = "archived_at")
    private LocalDateTime archivedAt;

    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;

    @Column(name = "read_at")
    private LocalDateTime readAt;

    @Column(name = "replied_at")
    private LocalDateTime repliedAt;

    @Column(name = "provider_message_id", length = 255)
    private String providerMessageId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "attachments", nullable = false, columnDefinition = "jsonb")
    private String attachments = "[]";

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

    public String getSenderKeycloakId() { return senderKeycloakId; }
    public void setSenderKeycloakId(String senderKeycloakId) { this.senderKeycloakId = senderKeycloakId; }

    public String getSenderFirstName() { return senderFirstName; }
    public void setSenderFirstName(String senderFirstName) { this.senderFirstName = senderFirstName; }

    public String getSenderLastName() { return senderLastName; }
    public void setSenderLastName(String senderLastName) { this.senderLastName = senderLastName; }

    public String getSenderEmail() { return senderEmail; }
    public void setSenderEmail(String senderEmail) { this.senderEmail = senderEmail; }

    public String getRecipientKeycloakId() { return recipientKeycloakId; }
    public void setRecipientKeycloakId(String recipientKeycloakId) { this.recipientKeycloakId = recipientKeycloakId; }

    public String getRecipientFirstName() { return recipientFirstName; }
    public void setRecipientFirstName(String recipientFirstName) { this.recipientFirstName = recipientFirstName; }

    public String getRecipientLastName() { return recipientLastName; }
    public void setRecipientLastName(String recipientLastName) { this.recipientLastName = recipientLastName; }

    public String getRecipientEmail() { return recipientEmail; }
    public void setRecipientEmail(String recipientEmail) { this.recipientEmail = recipientEmail; }

    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public ContactMessagePriority getPriority() { return priority; }
    public void setPriority(ContactMessagePriority priority) { this.priority = priority; }

    public ContactMessageCategory getCategory() { return category; }
    public void setCategory(ContactMessageCategory category) { this.category = category; }

    public ContactMessageStatus getStatus() { return status; }
    public void setStatus(ContactMessageStatus status) { this.status = status; }

    public boolean isArchived() { return archived; }
    public void setArchived(boolean archived) { this.archived = archived; }

    public LocalDateTime getArchivedAt() { return archivedAt; }
    public void setArchivedAt(LocalDateTime archivedAt) { this.archivedAt = archivedAt; }

    public LocalDateTime getDeliveredAt() { return deliveredAt; }
    public void setDeliveredAt(LocalDateTime deliveredAt) { this.deliveredAt = deliveredAt; }

    public LocalDateTime getReadAt() { return readAt; }
    public void setReadAt(LocalDateTime readAt) { this.readAt = readAt; }

    public LocalDateTime getRepliedAt() { return repliedAt; }
    public void setRepliedAt(LocalDateTime repliedAt) { this.repliedAt = repliedAt; }

    public String getProviderMessageId() { return providerMessageId; }
    public void setProviderMessageId(String providerMessageId) { this.providerMessageId = providerMessageId; }

    public String getAttachments() { return attachments; }
    public void setAttachments(String attachments) { this.attachments = attachments; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
