package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Depense prestataire liee a un logement.
 * Lifecycle : DRAFT -> APPROVED -> INCLUDED (dans un payout) -> PAID
 */
@Entity
@Table(name = "provider_expenses")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class ProviderExpense {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "provider_id", nullable = false)
    private User provider;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "intervention_id")
    private Intervention intervention;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_payout_id")
    private OwnerPayout ownerPayout;

    @Column(name = "description", nullable = false, length = 500)
    private String description;

    @Column(name = "amount_ht", precision = 12, scale = 2, nullable = false)
    private BigDecimal amountHt = BigDecimal.ZERO;

    @Column(name = "tax_rate", precision = 5, scale = 4, nullable = false)
    private BigDecimal taxRate = BigDecimal.ZERO;

    @Column(name = "tax_amount", precision = 12, scale = 2, nullable = false)
    private BigDecimal taxAmount = BigDecimal.ZERO;

    @Column(name = "amount_ttc", precision = 12, scale = 2, nullable = false)
    private BigDecimal amountTtc = BigDecimal.ZERO;

    @Column(name = "currency", nullable = false, length = 3, columnDefinition = "varchar(3) default 'EUR'")
    private String currency = "EUR";

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 30)
    private ExpenseCategory category;

    @Column(name = "expense_date", nullable = false)
    private LocalDate expenseDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ExpenseStatus status = ExpenseStatus.DRAFT;

    @Column(name = "invoice_reference", length = 100)
    private String invoiceReference;

    @Column(name = "receipt_path", length = 500)
    private String receiptPath;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "payment_reference", length = 255)
    private String paymentReference;

    // --- Pennylane sync tracking ---

    @Column(name = "pennylane_invoice_id", length = 50)
    private String pennylaneInvoiceId;

    @Column(name = "pennylane_synced_at")
    private Instant pennylaneSyncedAt;

    // --- End Pennylane sync tracking ---

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
        updatedAt = Instant.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }

    // Getters & Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public User getProvider() { return provider; }
    public void setProvider(User provider) { this.provider = provider; }

    public Property getProperty() { return property; }
    public void setProperty(Property property) { this.property = property; }

    public Intervention getIntervention() { return intervention; }
    public void setIntervention(Intervention intervention) { this.intervention = intervention; }

    public OwnerPayout getOwnerPayout() { return ownerPayout; }
    public void setOwnerPayout(OwnerPayout ownerPayout) { this.ownerPayout = ownerPayout; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public BigDecimal getAmountHt() { return amountHt; }
    public void setAmountHt(BigDecimal amountHt) { this.amountHt = amountHt; }

    public BigDecimal getTaxRate() { return taxRate; }
    public void setTaxRate(BigDecimal taxRate) { this.taxRate = taxRate; }

    public BigDecimal getTaxAmount() { return taxAmount; }
    public void setTaxAmount(BigDecimal taxAmount) { this.taxAmount = taxAmount; }

    public BigDecimal getAmountTtc() { return amountTtc; }
    public void setAmountTtc(BigDecimal amountTtc) { this.amountTtc = amountTtc; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public ExpenseCategory getCategory() { return category; }
    public void setCategory(ExpenseCategory category) { this.category = category; }

    public LocalDate getExpenseDate() { return expenseDate; }
    public void setExpenseDate(LocalDate expenseDate) { this.expenseDate = expenseDate; }

    public ExpenseStatus getStatus() { return status; }
    public void setStatus(ExpenseStatus status) { this.status = status; }

    public String getInvoiceReference() { return invoiceReference; }
    public void setInvoiceReference(String invoiceReference) { this.invoiceReference = invoiceReference; }

    public String getReceiptPath() { return receiptPath; }
    public void setReceiptPath(String receiptPath) { this.receiptPath = receiptPath; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public String getPaymentReference() { return paymentReference; }
    public void setPaymentReference(String paymentReference) { this.paymentReference = paymentReference; }

    public String getPennylaneInvoiceId() { return pennylaneInvoiceId; }
    public void setPennylaneInvoiceId(String pennylaneInvoiceId) { this.pennylaneInvoiceId = pennylaneInvoiceId; }

    public Instant getPennylaneSyncedAt() { return pennylaneSyncedAt; }
    public void setPennylaneSyncedAt(Instant pennylaneSyncedAt) { this.pennylaneSyncedAt = pennylaneSyncedAt; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
