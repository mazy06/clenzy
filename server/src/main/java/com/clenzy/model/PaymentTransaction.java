package com.clenzy.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "payment_transactions", indexes = {
    @Index(name = "idx_payment_tx_org", columnList = "organization_id"),
    @Index(name = "idx_payment_tx_status", columnList = "status"),
    @Index(name = "idx_payment_tx_provider", columnList = "provider_type"),
    @Index(name = "idx_payment_tx_source", columnList = "source_type, source_id"),
    @Index(name = "idx_payment_tx_idempotency", columnList = "idempotency_key")
})
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class PaymentTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @NotBlank
    @Column(name = "transaction_ref", nullable = false, length = 64)
    private String transactionRef;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "provider_type", nullable = false, length = 30)
    private PaymentProviderType providerType;

    @Column(name = "provider_tx_id", length = 255)
    private String providerTxId;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "payment_type", nullable = false, length = 30)
    private TransactionType paymentType;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TransactionStatus status = TransactionStatus.PENDING;

    @NotNull
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(length = 3, nullable = false)
    private String currency = "EUR";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> metadata;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "idempotency_key", length = 100)
    private String idempotencyKey;

    @Column(name = "source_type", length = 30)
    private String sourceType;

    @Column(name = "source_id")
    private Long sourceId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters & Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public String getTransactionRef() { return transactionRef; }
    public void setTransactionRef(String transactionRef) { this.transactionRef = transactionRef; }
    public PaymentProviderType getProviderType() { return providerType; }
    public void setProviderType(PaymentProviderType providerType) { this.providerType = providerType; }
    public String getProviderTxId() { return providerTxId; }
    public void setProviderTxId(String providerTxId) { this.providerTxId = providerTxId; }
    public TransactionType getPaymentType() { return paymentType; }
    public void setPaymentType(TransactionType paymentType) { this.paymentType = paymentType; }
    public TransactionStatus getStatus() { return status; }
    public void setStatus(TransactionStatus status) { this.status = status; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public Map<String, Object> getMetadata() { return metadata; }
    public void setMetadata(Map<String, Object> metadata) { this.metadata = metadata; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }
    public Long getSourceId() { return sourceId; }
    public void setSourceId(Long sourceId) { this.sourceId = sourceId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
