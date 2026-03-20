package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "property_photos")
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :organizationId"
)
public class PropertyPhoto {

    public enum PhotoSource {
        MANUAL, AIRBNB, BOOKING, EXPEDIA, ICAL
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "property_id", nullable = false, insertable = false, updatable = false)
    private Long propertyId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "storage_key", length = 500)
    private String storageKey;

    @Column(name = "original_filename", length = 255)
    private String originalFilename;

    @Column(name = "content_type", nullable = false, length = 100)
    private String contentType = "image/jpeg";

    @Column(name = "file_size")
    private Long fileSize;

    @Basic(fetch = FetchType.LAZY)
    @Column(name = "data", columnDefinition = "bytea")
    private byte[] data;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(name = "caption", length = 500)
    private String caption;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", length = 50)
    private PhotoSource source = PhotoSource.MANUAL;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    public PropertyPhoto() {}

    // Getters and setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getPropertyId() { return propertyId; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getStorageKey() { return storageKey; }
    public void setStorageKey(String storageKey) { this.storageKey = storageKey; }

    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String originalFilename) { this.originalFilename = originalFilename; }

    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }

    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }

    public byte[] getData() { return data; }
    public void setData(byte[] data) { this.data = data; }

    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }

    public String getCaption() { return caption; }
    public void setCaption(String caption) { this.caption = caption; }

    public PhotoSource getSource() { return source; }
    public void setSource(PhotoSource source) { this.source = source; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public Property getProperty() { return property; }
    public void setProperty(Property property) { this.property = property; }

    /**
     * Backward-compatible URL getter for booking engine DTOs.
     * Returns the storage key prefixed with the API path for photo retrieval.
     */
    public String getUrl() {
        if (storageKey != null && property != null) {
            return "/api/properties/" + property.getId() + "/photos/" + id + "/data";
        }
        return null;
    }
}
