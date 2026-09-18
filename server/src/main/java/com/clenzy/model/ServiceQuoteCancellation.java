package com.clenzy.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

/** Annulation immuable ; le devis et ses avenants acceptés restent archivés. */
@Entity
@Table(name = "service_quote_cancellations")
public class ServiceQuoteCancellation {
    @Id @Column(name = "quote_id") private Long quoteId;
    @Column(name = "organization_id", nullable = false) private Long organizationId;
    @Column(name = "intervention_id") private Long interventionId;
    @Column(name = "actor_subject", nullable = false, length = 120) private String actorSubject;
    @Column(nullable = false, length = 1000) private String reason;
    @Column(name = "cancelled_at", nullable = false) private Instant cancelledAt;
    @Column(name = "agreed_amount", nullable = false, precision = 19, scale = 2) private BigDecimal agreedAmount;
    @Column(nullable = false, length = 8) private String currency;

    protected ServiceQuoteCancellation() {}
    public ServiceQuoteCancellation(ServiceQuote quote, String actor, String reason, Instant at, BigDecimal amount, String currency) {
        this.quoteId = quote.getId(); this.organizationId = quote.getOrganizationId();
        this.interventionId = quote.getInterventionId(); this.actorSubject = actor;
        this.reason = reason; this.cancelledAt = at; this.agreedAmount = amount; this.currency = currency;
    }
    public Long getQuoteId() { return quoteId; }
    public Long getOrganizationId() { return organizationId; }
    public Long getInterventionId() { return interventionId; }
    public String getActorSubject() { return actorSubject; }
    public String getReason() { return reason; }
    public Instant getCancelledAt() { return cancelledAt; }
    public BigDecimal getAgreedAmount() { return agreedAmount; }
    public String getCurrency() { return currency; }
}
