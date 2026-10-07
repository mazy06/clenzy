package com.clenzy.model;

import jakarta.persistence.*;
import java.time.Instant;

/** Copie de rapprochement de la facture PSP ; les montants HT et TTC ne sont jamais confondus. */
@Entity
@Table(name="baitly_subscription_invoices")
public class BaitlySubscriptionInvoice {
    @Id @Column(name="invoice_id") private String invoiceId;
    @Column(name="organization_id",nullable=false) private Long organizationId;
    @Column(name="order_id",nullable=false) private Long orderId;
    @Column(nullable=false) private String status;
    @Column(nullable=false,length=3) private String currency;
    @Column(name="total_cents",nullable=false) private long totalCents;
    @Column(name="excluding_tax_cents",nullable=false) private long excludingTaxCents;
    @Column(name="paid_cents",nullable=false) private long paidCents;
    @Column(name="remaining_cents",nullable=false) private long remainingCents;
    @Column(name="hosted_url",columnDefinition="text") private String hostedUrl;
    @Column(name="pdf_url",columnDefinition="text") private String pdfUrl;
    @Column(name="issued_at",nullable=false) private Instant issuedAt;
    public String getInvoiceId(){return invoiceId;} public void setInvoiceId(String v){invoiceId=v;}
    public Long getOrganizationId(){return organizationId;} public void setOrganizationId(Long v){organizationId=v;}
    public Long getOrderId(){return orderId;} public void setOrderId(Long v){orderId=v;}
    public String getStatus(){return status;} public void setStatus(String v){status=v;}
    public String getCurrency(){return currency;} public void setCurrency(String v){currency=v;}
    public long getTotalCents(){return totalCents;} public void setTotalCents(long v){totalCents=v;}
    public long getExcludingTaxCents(){return excludingTaxCents;} public void setExcludingTaxCents(long v){excludingTaxCents=v;}
    public long getPaidCents(){return paidCents;} public void setPaidCents(long v){paidCents=v;}
    public long getRemainingCents(){return remainingCents;} public void setRemainingCents(long v){remainingCents=v;}
    public String getHostedUrl(){return hostedUrl;} public void setHostedUrl(String v){hostedUrl=v;}
    public String getPdfUrl(){return pdfUrl;} public void setPdfUrl(String v){pdfUrl=v;}
    public Instant getIssuedAt(){return issuedAt;} public void setIssuedAt(Instant v){issuedAt=v;}
}
