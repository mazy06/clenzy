package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Piece jointe d'un message de contact. Le fichier vit sur le stockage objet (OVH en production)
 * sous {@code storageKey} ; {@code data} (BYTEA) ne subsiste que pour les pieces jointes anterieures,
 * reprises par la migration automatique vers le stockage objet.
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

    @Column(columnDefinition = "bytea")
    private byte[] data;

    @Column(name = "storage_key", length = 500)
    private String storageKey;

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

    /** Piece jointe deja ecrite sur le stockage : seule sa cle est enregistree. */
    public static ContactAttachmentFile stored(Long messageId, String attachmentId, String storageKey,
                                               String contentType, String originalName, Long size) {
        final ContactAttachmentFile file = new ContactAttachmentFile(
                messageId, attachmentId, null, contentType, originalName, size);
        file.storageKey = storageKey;
        return file;
    }

    // ─── Getters & Setters ───

    public Long getId() { return id; }

    public Long getMessageId() { return messageId; }
    public void setMessageId(Long messageId) { this.messageId = messageId; }

    public String getAttachmentId() { return attachmentId; }
    public void setAttachmentId(String attachmentId) { this.attachmentId = attachmentId; }

    public byte[] getData() { return data; }
    public void setData(byte[] data) { this.data = data; }

    public String getStorageKey() { return storageKey; }
    public void setStorageKey(String storageKey) { this.storageKey = storageKey; }

    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }

    public String getOriginalName() { return originalName; }
    public void setOriginalName(String originalName) { this.originalName = originalName; }

    public Long getSize() { return size; }
    public void setSize(Long size) { this.size = size; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
