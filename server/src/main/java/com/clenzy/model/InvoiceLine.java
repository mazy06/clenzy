package com.clenzy.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Ligne de facture avec detail de la taxation.
 * Chaque ligne a sa propre categorie de taxe et son taux applicable.
 */
@Entity
@Table(name = "invoice_lines", indexes = {
    @Index(name = "idx_invoice_lines_invoice", columnList = "invoice_id")
})
public class InvoiceLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id", nullable = false)
    private Invoice invoice;

    @NotNull
    @Column(name = "line_number", nullable = false)
    private Integer lineNumber;

    @NotBlank
    @Size(max = 500)
    @Column(name = "description", nullable = false, length = 500)
    private String description;

    @NotNull
    @Column(name = "quantity", nullable = false, precision = 10, scale = 3)
    private BigDecimal quantity = BigDecimal.ONE;

    @NotNull
    @Column(name = "unit_price_ht", nullable = false, precision = 10, scale = 2)
    private BigDecimal unitPriceHt;

    @NotBlank
    @Size(max = 30)
    @Column(name = "tax_category", nullable = false, length = 30)
    private String taxCategory;

    @NotNull
    @Column(name = "tax_rate", nullable = false, precision = 5, scale = 4)
    private BigDecimal taxRate;

    @NotNull
    @Column(name = "tax_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal taxAmount;

    @NotNull
    @Column(name = "total_ht", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalHt;

    @NotNull
    @Column(name = "total_ttc", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalTtc;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    // --- Constructeurs ---

    public InvoiceLine() {}

    // --- Getters / Setters ---

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Invoice getInvoice() { return invoice; }
    public void setInvoice(Invoice invoice) { this.invoice = invoice; }

    public Integer getLineNumber() { return lineNumber; }
    public void setLineNumber(Integer lineNumber) { this.lineNumber = lineNumber; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }

    public BigDecimal getUnitPriceHt() { return unitPriceHt; }
    public void setUnitPriceHt(BigDecimal unitPriceHt) { this.unitPriceHt = unitPriceHt; }

    public String getTaxCategory() { return taxCategory; }
    public void setTaxCategory(String taxCategory) { this.taxCategory = taxCategory; }

    public BigDecimal getTaxRate() { return taxRate; }
    public void setTaxRate(BigDecimal taxRate) { this.taxRate = taxRate; }

    public BigDecimal getTaxAmount() { return taxAmount; }
    public void setTaxAmount(BigDecimal taxAmount) { this.taxAmount = taxAmount; }

    public BigDecimal getTotalHt() { return totalHt; }
    public void setTotalHt(BigDecimal totalHt) { this.totalHt = totalHt; }

    public BigDecimal getTotalTtc() { return totalTtc; }
    public void setTotalTtc(BigDecimal totalTtc) { this.totalTtc = totalTtc; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    @Override
    public String toString() {
        return "InvoiceLine{" +
                "id=" + id +
                ", lineNumber=" + lineNumber +
                ", description='" + description + '\'' +
                ", totalHt=" + totalHt +
                '}';
    }
}
