package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Stockage binaire des pieces jointes de messages de contact.
 * Les fichiers sont stockes directement en base de donnees (BYTEA)
 * au lieu du systeme de fichiers.
 */
@Entity
@Table(name = "contact_attachment_files")
public class ContactAttachmentFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "message_id", nullable = false)
    private Long messageId;

    @Column(name = "attachment_id", nullable = false, length = 36)
    private String attachmentId;

    @Column(nullable = false, columnDefinition = "bytea")
    private byte[] data;

    @Column(name = "content_type", length = 100)
    private String contentType;

    @Column(name = "original_name", length = 500)
    private String originalName;

    private Long size;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    // ─── Constructors ───

    public ContactAttachmentFile() {}

    public ContactAttachmentFile(Long messageId, String attachmentId, byte[] data,
                                  String contentType, String originalName, Long size) {
        this.messageId = messageId;
        this.attachmentId = attachmentId;
        this.data = data;
        this.contentType = contentType;
        this.originalName = originalName;
        this.size = size;
    }

    // ─── Getters & Setters ───

    public Long getId() { return id; }

    public Long getMessageId() { return messageId; }
    public void setMessageId(Long messageId) { this.messageId = messageId; }

    public String getAttachmentId() { return attachmentId; }
    public void setAttachmentId(String attachmentId) { this.attachmentId = attachmentId; }

    public byte[] getData() { return data; }
    public void setData(byte[] data) { this.data = data; }

    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }

    public String getOriginalName() { return originalName; }
    public void setOriginalName(String originalName) { this.originalName = originalName; }

    public Long getSize() { return size; }
    public void setSize(Long size) { this.size = size; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
