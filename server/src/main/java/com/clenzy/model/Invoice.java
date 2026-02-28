package com.clenzy.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.FilterDef;
import org.hibernate.annotations.ParamDef;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Facture formelle conforme aux exigences legales par pays.
 * Les factures emises (status=ISSUED) sont immutables.
 * Corrections uniquement via CREDIT_NOTE.
 */
@Entity
@Table(name = "invoices", indexes = {
    @Index(name = "idx_invoice_org", columnList = "organization_id"),
    @Index(name = "idx_invoice_status", columnList = "status"),
    @Index(name = "idx_invoice_date", columnList = "invoice_date"),
    @Index(name = "idx_invoice_reservation", columnList = "reservation_id")
})
@FilterDef(name = "organizationFilter", parameters = @ParamDef(name = "orgId", type = Long.class))
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class Invoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @NotBlank
    @Size(max = 30)
    @Column(name = "invoice_number", nullable = false, length = 30)
    private String invoiceNumber;

    @NotNull
    @Column(name = "invoice_date", nullable = false)
    private LocalDate invoiceDate;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @NotBlank
    @Size(max = 3)
    @Column(name = "currency", nullable = false, length = 3)
    private String currency = "EUR";

    @NotBlank
    @Size(max = 3)
    @Column(name = "country_code", nullable = false, length = 3)
    private String countryCode = "FR";

    @NotNull
    @Column(name = "total_ht", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalHt;

    @NotNull
    @Column(name = "total_tax", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalTax;

    @NotNull
    @Column(name = "total_ttc", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalTtc;

    @Size(max = 200)
    @Column(name = "seller_name", length = 200)
    private String sellerName;

    @Column(name = "seller_address", columnDefinition = "TEXT")
    private String sellerAddress;

    @Size(max = 50)
    @Column(name = "seller_tax_id", length = 50)
    private String sellerTaxId;

    @Size(max = 200)
    @Column(name = "buyer_name", length = 200)
    private String buyerName;

    @Column(name = "buyer_address", columnDefinition = "TEXT")
    private String buyerAddress;

    @Size(max = 50)
    @Column(name = "buyer_tax_id", length = 50)
    private String buyerTaxId;

    @Column(name = "reservation_id")
    private Long reservationId;

    @Column(name = "payout_id")
    private Long payoutId;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private InvoiceStatus status = InvoiceStatus.DRAFT;

    @Column(name = "legal_mentions", columnDefinition = "TEXT")
    private String legalMentions;

    @Column(name = "qr_code_data", columnDefinition = "TEXT")
    private String qrCodeData;

    @Column(name = "xml_content", columnDefinition = "TEXT")
    private String xmlContent;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // --- Relations ---

    @OneToMany(mappedBy = "invoice", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("lineNumber ASC")
    private List<InvoiceLine> lines = new ArrayList<>();

    // --- Constructeurs ---

    public Invoice() {}

    // --- Methodes utilitaires ---

    public void addLine(InvoiceLine line) {
        lines.add(line);
        line.setInvoice(this);
    }

    public boolean isImmutable() {
        return status == InvoiceStatus.ISSUED || status == InvoiceStatus.PAID;
    }

    // --- Getters / Setters ---

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getInvoiceNumber() { return invoiceNumber; }
    public void setInvoiceNumber(String invoiceNumber) { this.invoiceNumber = invoiceNumber; }

    public LocalDate getInvoiceDate() { return invoiceDate; }
    public void setInvoiceDate(LocalDate invoiceDate) { this.invoiceDate = invoiceDate; }

    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getCountryCode() { return countryCode; }
    public void setCountryCode(String countryCode) { this.countryCode = countryCode; }

    public BigDecimal getTotalHt() { return totalHt; }
    public void setTotalHt(BigDecimal totalHt) { this.totalHt = totalHt; }

    public BigDecimal getTotalTax() { return totalTax; }
    public void setTotalTax(BigDecimal totalTax) { this.totalTax = totalTax; }

    public BigDecimal getTotalTtc() { return totalTtc; }
    public void setTotalTtc(BigDecimal totalTtc) { this.totalTtc = totalTtc; }

    public String getSellerName() { return sellerName; }
    public void setSellerName(String sellerName) { this.sellerName = sellerName; }

    public String getSellerAddress() { return sellerAddress; }
    public void setSellerAddress(String sellerAddress) { this.sellerAddress = sellerAddress; }

    public String getSellerTaxId() { return sellerTaxId; }
    public void setSellerTaxId(String sellerTaxId) { this.sellerTaxId = sellerTaxId; }

    public String getBuyerName() { return buyerName; }
    public void setBuyerName(String buyerName) { this.buyerName = buyerName; }

    public String getBuyerAddress() { return buyerAddress; }
    public void setBuyerAddress(String buyerAddress) { this.buyerAddress = buyerAddress; }

    public String getBuyerTaxId() { return buyerTaxId; }
    public void setBuyerTaxId(String buyerTaxId) { this.buyerTaxId = buyerTaxId; }

    public Long getReservationId() { return reservationId; }
    public void setReservationId(Long reservationId) { this.reservationId = reservationId; }

    public Long getPayoutId() { return payoutId; }
    public void setPayoutId(Long payoutId) { this.payoutId = payoutId; }

    public InvoiceStatus getStatus() { return status; }
    public void setStatus(InvoiceStatus status) { this.status = status; }

    public String getLegalMentions() { return legalMentions; }
    public void setLegalMentions(String legalMentions) { this.legalMentions = legalMentions; }

    public String getQrCodeData() { return qrCodeData; }
    public void setQrCodeData(String qrCodeData) { this.qrCodeData = qrCodeData; }

    public String getXmlContent() { return xmlContent; }
    public void setXmlContent(String xmlContent) { this.xmlContent = xmlContent; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public List<InvoiceLine> getLines() { return lines; }
    public void setLines(List<InvoiceLine> lines) { this.lines = lines; }

    @Override
    public String toString() {
        return "Invoice{" +
                "id=" + id +
                ", invoiceNumber='" + invoiceNumber + '\'' +
                ", status=" + status +
                ", totalTtc=" + totalTtc +
                ", currency='" + currency + '\'' +
                '}';
    }
}
