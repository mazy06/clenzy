package com.clenzy.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Compteur de numerotation sequentielle par type de document et annee.
 * Garantit une numerotation sans trous (NF) via verrouillage pessimiste.
 */
@Entity
@Table(name = "document_number_sequences",
       uniqueConstraints = @UniqueConstraint(columnNames = {"document_type", "year"}))
public class DocumentNumberSequence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "document_type", nullable = false, length = 50)
    private String documentType;

    @Column(nullable = false)
    private Integer year;

    @Column(nullable = false, length = 20)
    private String prefix;

    @Column(name = "last_number", nullable = false)
    private Integer lastNumber = 0;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public DocumentNumberSequence() {}

    public DocumentNumberSequence(String documentType, Integer year, String prefix) {
        this.documentType = documentType;
        this.year = year;
        this.prefix = prefix;
        this.lastNumber = 0;
    }

    // ─── Getters / Setters ────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getDocumentType() { return documentType; }
    public void setDocumentType(String documentType) { this.documentType = documentType; }

    public Integer getYear() { return year; }
    public void setYear(Integer year) { this.year = year; }

    public String getPrefix() { return prefix; }
    public void setPrefix(String prefix) { this.prefix = prefix; }

    public Integer getLastNumber() { return lastNumber; }
    public void setLastNumber(Integer lastNumber) { this.lastNumber = lastNumber; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    /**
     * Incremente le compteur et retourne le nouveau numero.
     */
    public int incrementAndGet() {
        this.lastNumber++;
        this.updatedAt = LocalDateTime.now();
        return this.lastNumber;
    }
}
