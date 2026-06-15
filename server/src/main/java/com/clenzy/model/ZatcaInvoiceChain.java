package com.clenzy.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Maillon de la chaîne ZATCA (CLZ-P0-21) : pour chaque facture émise en Arabie Saoudite, on
 * persiste son <b>ICV</b> (Invoice Counter Value, séquence monotone par org/EGS) et son
 * <b>PIH</b> (Previous Invoice Hash) — le hash SHA-256 Base64 de la facture précédente. Toute
 * rupture de chaîne (ICV manquant, PIH incohérent) est un signal de fraude.
 *
 * <p>Double unicité (garde-fou DB anti check-then-act, audit #8) :
 * {@code (organization_id, icv)} sérialise la séquence, {@code (organization_id, invoice_number)}
 * rend l'ajout idempotent (une facture n'entre qu'une fois dans la chaîne).</p>
 */
@Entity
@Table(name = "zatca_invoice_chain",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_zatca_chain_org_icv", columnNames = {"organization_id", "icv"}),
        @UniqueConstraint(name = "uq_zatca_chain_org_invoice",
            columnNames = {"organization_id", "invoice_number"})
    })
public class ZatcaInvoiceChain {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    /** Invoice Counter Value — séquence monotone à partir de 1. */
    @NotNull
    @Column(name = "icv", nullable = false)
    private Long icv;

    @NotBlank
    @Size(max = 64)
    @Column(name = "invoice_number", nullable = false, length = 64)
    private String invoiceNumber;

    /** Hash SHA-256 Base64 de cette facture (incorpore le PIH). */
    @NotBlank
    @Size(max = 64)
    @Column(name = "invoice_hash", nullable = false, length = 64)
    private String invoiceHash;

    /** PIH — hash de la facture précédente (genesis = Base64(SHA-256("0"))). */
    @NotBlank
    @Size(max = 64)
    @Column(name = "previous_invoice_hash", nullable = false, length = 64)
    private String previousInvoiceHash;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    public ZatcaInvoiceChain() {}

    public ZatcaInvoiceChain(Long organizationId, Long icv, String invoiceNumber,
                             String invoiceHash, String previousInvoiceHash) {
        this.organizationId = organizationId;
        this.icv = icv;
        this.invoiceNumber = invoiceNumber;
        this.invoiceHash = invoiceHash;
        this.previousInvoiceHash = previousInvoiceHash;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getIcv() { return icv; }
    public void setIcv(Long icv) { this.icv = icv; }

    public String getInvoiceNumber() { return invoiceNumber; }
    public void setInvoiceNumber(String invoiceNumber) { this.invoiceNumber = invoiceNumber; }

    public String getInvoiceHash() { return invoiceHash; }
    public void setInvoiceHash(String invoiceHash) { this.invoiceHash = invoiceHash; }

    public String getPreviousInvoiceHash() { return previousInvoiceHash; }
    public void setPreviousInvoiceHash(String previousInvoiceHash) { this.previousInvoiceHash = previousInvoiceHash; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
