package com.clenzy.marketplace.model;

import jakarta.persistence.*;
import java.time.LocalDate;

/** Échéancier consenti par le demandeur ; aucun prix ni prestataire reconduit. */
@Entity
@Table(name = "marketplace_recurrences")
public class MarketplaceRecurrence {
    @Id @Column(name = "quote_request_id")
    private Long quoteRequestId;
    @Column(name = "organization_id", nullable = false)
    private Long organizationId;
    @Column(name = "consent_owner_id", nullable = false) private Long consentOwnerId;
    @Version private long version;
    @Column(nullable = false) private boolean enabled;
    @Column(name = "anchor_date", nullable = false) private LocalDate anchorDate;
    @Column(name = "interval_unit", nullable = false, length = 10) private String intervalUnit;
    @Column(name = "interval_count", nullable = false) private int intervalCount;
    @Column(name = "lead_days", nullable = false) private int leadDays;
    @Column(name = "occurrence_index", nullable = false) private int occurrenceIndex;
    @Column(name = "next_date", nullable = false) private LocalDate nextDate;
    @Column(name = "last_request_id") private Long lastRequestId;

    public Long getQuoteRequestId() { return quoteRequestId; }
    public void setQuoteRequestId(Long value) { quoteRequestId = value; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long value) { organizationId = value; }
    public long getVersion() { return version; }
    public Long getConsentOwnerId() { return consentOwnerId; }
    public void setConsentOwnerId(Long value) { consentOwnerId = value; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean value) { enabled = value; }
    public LocalDate getAnchorDate() { return anchorDate; }
    public String getIntervalUnit() { return intervalUnit; }
    public int getIntervalCount() { return intervalCount; }
    public int getLeadDays() { return leadDays; }
    public LocalDate getNextDate() { return nextDate; }
    public Long getLastRequestId() { return lastRequestId; }
    public void configure(LocalDate first, String unit, int count, int lead) {
        anchorDate = first; intervalUnit = unit; intervalCount = count;
        leadDays = lead; occurrenceIndex = 0; nextDate = first;
    }
    public void generated(Long requestId) {
        lastRequestId = requestId;
        occurrenceIndex = Math.incrementExact(occurrenceIndex);
        long offset = Math.multiplyExact((long) occurrenceIndex, intervalCount);
        nextDate = "DAYS".equals(intervalUnit) ? anchorDate.plusDays(offset) : anchorDate.plusMonths(offset);
    }
}
