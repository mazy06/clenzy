package com.clenzy.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "contact_messages")
public class ContactMessage {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipient_id", nullable = false)
    private User recipient;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id")
    private Property property;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "message_type", nullable = false)
    private ContactMessageType messageType;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "priority", nullable = false)
    private ContactPriority priority;
    
    @Column(name = "subject", nullable = false, length = 255)
    private String subject;
    
    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ContactStatus status = ContactStatus.OUVERT;
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
    
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();
    
    @OneToMany(mappedBy = "message", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ContactAttachment> attachments;
    
    // Constructeurs
    public ContactMessage() {}
    
    public ContactMessage(User sender, User recipient, ContactMessageType messageType, 
                         ContactPriority priority, String subject, String content) {
        this.sender = sender;
        this.recipient = recipient;
        this.messageType = messageType;
        this.priority = priority;
        this.subject = subject;
        this.content = content;
    }
    
    // Getters et Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    public User getSender() { return sender; }
    public void setSender(User sender) { this.sender = sender; }
    
    public User getRecipient() { return recipient; }
    public void setRecipient(User recipient) { this.recipient = recipient; }
    
    public Property getProperty() { return property; }
    public void setProperty(Property property) { this.property = property; }
    
    public ContactMessageType getMessageType() { return messageType; }
    public void setMessageType(ContactMessageType messageType) { this.messageType = messageType; }
    
    public ContactPriority getPriority() { return priority; }
    public void setPriority(ContactPriority priority) { this.priority = priority; }
    
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    
    public ContactStatus getStatus() { return status; }
    public void setStatus(ContactStatus status) { this.status = status; }
    
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    
    public List<ContactAttachment> getAttachments() { return attachments; }
    public void setAttachments(List<ContactAttachment> attachments) { this.attachments = attachments; }
    
    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
