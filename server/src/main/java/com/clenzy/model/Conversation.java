package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Conversation multi-canal dans l'inbox unifie.
 * Regroupe les messages echanges avec un guest via un canal donne.
 */
@Entity
@Table(name = "conversations")
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class Conversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guest_id")
    private Guest guest;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id")
    private Property property;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reservation_id")
    private Reservation reservation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ConversationChannel channel = ConversationChannel.INTERNAL;

    @Column(name = "external_conversation_id")
    private String externalConversationId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ConversationStatus status = ConversationStatus.OPEN;

    @Column(length = 500)
    private String subject;

    @Column(name = "last_message_preview", columnDefinition = "TEXT")
    private String lastMessagePreview;

    @Column(name = "last_message_at")
    private LocalDateTime lastMessageAt;

    @Column(name = "assigned_to_keycloak_id")
    private String assignedToKeycloakId;

    @Column(nullable = false)
    private boolean unread = true;

    @Column(name = "message_count", nullable = false)
    private int messageCount = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // Getters & setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Guest getGuest() { return guest; }
    public void setGuest(Guest guest) { this.guest = guest; }

    public Property getProperty() { return property; }
    public void setProperty(Property property) { this.property = property; }

    public Reservation getReservation() { return reservation; }
    public void setReservation(Reservation reservation) { this.reservation = reservation; }

    public ConversationChannel getChannel() { return channel; }
    public void setChannel(ConversationChannel channel) { this.channel = channel; }

    public String getExternalConversationId() { return externalConversationId; }
    public void setExternalConversationId(String externalConversationId) { this.externalConversationId = externalConversationId; }

    public ConversationStatus getStatus() { return status; }
    public void setStatus(ConversationStatus status) { this.status = status; }

    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }

    public String getLastMessagePreview() { return lastMessagePreview; }
    public void setLastMessagePreview(String lastMessagePreview) { this.lastMessagePreview = lastMessagePreview; }

    public LocalDateTime getLastMessageAt() { return lastMessageAt; }
    public void setLastMessageAt(LocalDateTime lastMessageAt) { this.lastMessageAt = lastMessageAt; }

    public String getAssignedToKeycloakId() { return assignedToKeycloakId; }
    public void setAssignedToKeycloakId(String assignedToKeycloakId) { this.assignedToKeycloakId = assignedToKeycloakId; }

    public boolean isUnread() { return unread; }
    public void setUnread(boolean unread) { this.unread = unread; }

    public int getMessageCount() { return messageCount; }
    public void setMessageCount(int messageCount) { this.messageCount = messageCount; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
