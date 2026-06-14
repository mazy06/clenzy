package com.clenzy.model;

import com.clenzy.fiscal.einvoicing.EInvoiceStatus;
import com.clenzy.fiscal.einvoicing.EInvoicingMode;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Suivi de soumission d'e-invoicing d'une facture (CLZ-P0-04).
 *
 * Idempotent par couple unique {@code (organization_id, invoice_number)} : une facture
 * n'est soumise qu'une fois a l'autorite fiscale. Trace le provider/mode/statut et la
 * reference externe retournee.
 */
@Entity
@Table(name = "einvoice_submissions",
    uniqueConstraints = @UniqueConstraint(name = "uq_einvoice_org_invoice",
        columnNames = {"organization_id", "invoice_number"}))
public class EInvoiceSubmission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @NotBlank
    @Size(max = 64)
    @Column(name = "invoice_number", nullable = false, length = 64)
    private String invoiceNumber;

    @Size(max = 2)
    @Column(name = "country_code", length = 2)
    private String countryCode;

    @NotBlank
    @Size(max = 40)
    @Column(name = "provider_code", nullable = false, length = 40)
    private String providerCode;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "mode", nullable = false, length = 32)
    private EInvoicingMode mode;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private EInvoiceStatus status;

    @Size(max = 128)
    @Column(name = "external_ref", length = 128)
    private String externalRef;

    @Size(max = 512)
    @Column(name = "message", length = 512)
    private String message;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public EInvoiceSubmission() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getInvoiceNumber() { return invoiceNumber; }
    public void setInvoiceNumber(String invoiceNumber) { this.invoiceNumber = invoiceNumber; }

    public String getCountryCode() { return countryCode; }
    public void setCountryCode(String countryCode) { this.countryCode = countryCode; }

    public String getProviderCode() { return providerCode; }
    public void setProviderCode(String providerCode) { this.providerCode = providerCode; }

    public EInvoicingMode getMode() { return mode; }
    public void setMode(EInvoicingMode mode) { this.mode = mode; }

    public EInvoiceStatus getStatus() { return status; }
    public void setStatus(EInvoiceStatus status) { this.status = status; }

    public String getExternalRef() { return externalRef; }
    public void setExternalRef(String externalRef) { this.externalRef = externalRef; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
