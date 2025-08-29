package com.clenzy.dto;

import com.clenzy.model.ContactMessageType;
import com.clenzy.model.ContactPriority;
import com.clenzy.model.ContactStatus;
import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.List;

public class ContactMessageDto {
    
    private Long id;
    
    @NotNull(message = "L'expéditeur est requis")
    private Long senderId;
    
    @NotNull(message = "Le destinataire est requis")
    private Long recipientId;
    
    private Long propertyId;
    
    @NotNull(message = "Le type de message est requis")
    private ContactMessageType messageType;
    
    @NotNull(message = "La priorité est requise")
    private ContactPriority priority;
    
    @NotBlank(message = "Le sujet est requis")
    @Size(max = 255, message = "Le sujet ne peut pas dépasser 255 caractères")
    private String subject;
    
    @NotBlank(message = "Le contenu est requis")
    @Size(max = 5000, message = "Le contenu ne peut pas dépasser 5000 caractères")
    private String content;
    
    private ContactStatus status;
    
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;
    
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updatedAt;
    
    private List<ContactAttachmentDto> attachments;
    
    // Informations complémentaires pour l'affichage
    private String senderName;
    private String recipientName;
    private String propertyName;
    
    // Constructeurs
    public ContactMessageDto() {}
    
    public ContactMessageDto(Long senderId, Long recipientId, ContactMessageType messageType,
                           ContactPriority priority, String subject, String content) {
        this.senderId = senderId;
        this.recipientId = recipientId;
        this.messageType = messageType;
        this.priority = priority;
        this.subject = subject;
        this.content = content;
    }
    
    // Getters et Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    public Long getSenderId() { return senderId; }
    public void setSenderId(Long senderId) { this.senderId = senderId; }
    
    public Long getRecipientId() { return recipientId; }
    public void setRecipientId(Long recipientId) { this.recipientId = recipientId; }
    
    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }
    
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
    
    public List<ContactAttachmentDto> getAttachments() { return attachments; }
    public void setAttachments(List<ContactAttachmentDto> attachments) { this.attachments = attachments; }
    
    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }
    
    public String getRecipientName() { return recipientName; }
    public void setRecipientName(String recipientName) { this.recipientName = recipientName; }
    
    public String getPropertyName() { return propertyName; }
    public void setPropertyName(String propertyName) { this.propertyName = propertyName; }
}
