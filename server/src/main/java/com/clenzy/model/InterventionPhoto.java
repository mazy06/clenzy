package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "intervention_photos")
public class InterventionPhoto {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "intervention_id", nullable = false)
    private Intervention intervention;
    
    @Lob
    @Column(name = "photo_data", nullable = false, columnDefinition = "BYTEA")
    private byte[] photoData;
    
    @Column(name = "content_type", length = 50)
    private String contentType; // ex: "image/jpeg", "image/png"
    
    @Column(name = "file_name", length = 255)
    private String fileName;
    
    @Column(length = 500)
    private String caption;
    
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    public InterventionPhoto() {}
    
    public InterventionPhoto(Intervention intervention, byte[] photoData, String contentType) {
        this.intervention = intervention;
        this.photoData = photoData;
        this.contentType = contentType;
    }
    
    // Getters and Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public Intervention getIntervention() {
        return intervention;
    }
    
    public void setIntervention(Intervention intervention) {
        this.intervention = intervention;
    }
    
    public byte[] getPhotoData() {
        return photoData;
    }
    
    public void setPhotoData(byte[] photoData) {
        this.photoData = photoData;
    }
    
    public String getContentType() {
        return contentType;
    }
    
    public void setContentType(String contentType) {
        this.contentType = contentType;
    }
    
    public String getFileName() {
        return fileName;
    }
    
    public void setFileName(String fileName) {
        this.fileName = fileName;
    }
    
    public String getCaption() {
        return caption;
    }
    
    public void setCaption(String caption) {
        this.caption = caption;
    }
    
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
    
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
