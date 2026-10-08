package com.clenzy.model;

import jakarta.persistence.*;
import java.util.UUID;

/** Accusé partenaire durable, conservé avant acquittement du flux PULL. */
@Entity
@Table(name = "baitly_iopole_statuses", uniqueConstraints = @UniqueConstraint(columnNames = {"environment", "customer_id", "status_id"}))
public class BaitlyIopoleStatus {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "organization_id", nullable = false) private Long organizationId;
    @Column(nullable = false, length = 10) private String environment;
    @Column(name = "customer_id", nullable = false) private UUID customerId;
    @Column(name = "status_id", nullable = false) private UUID statusId;
    @Column(name = "invoice_id", nullable = false) private UUID invoiceId;
    @Column(nullable = false, columnDefinition = "text") private String body;

    protected BaitlyIopoleStatus() {}
    public Long getOrganizationId() { return organizationId; }
    public UUID getInvoiceId() { return invoiceId; }
    public String getBody() { return body; }
}
