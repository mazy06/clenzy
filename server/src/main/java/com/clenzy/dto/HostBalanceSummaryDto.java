package com.clenzy.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * DTO pour le cumul des impayes d'un host, groupe par propriete.
 */
public class HostBalanceSummaryDto {

    private Long hostId;
    private String hostName;
    private String hostEmail;
    private BigDecimal totalUnpaid;
    private int totalInterventions;
    private List<PropertyBalanceDto> properties;

    // Constructeurs
    public HostBalanceSummaryDto() {}

    // Getters & Setters
    public Long getHostId() { return hostId; }
    public void setHostId(Long hostId) { this.hostId = hostId; }

    public String getHostName() { return hostName; }
    public void setHostName(String hostName) { this.hostName = hostName; }

    public String getHostEmail() { return hostEmail; }
    public void setHostEmail(String hostEmail) { this.hostEmail = hostEmail; }

    public BigDecimal getTotalUnpaid() { return totalUnpaid; }
    public void setTotalUnpaid(BigDecimal totalUnpaid) { this.totalUnpaid = totalUnpaid; }

    public int getTotalInterventions() { return totalInterventions; }
    public void setTotalInterventions(int totalInterventions) { this.totalInterventions = totalInterventions; }

    public List<PropertyBalanceDto> getProperties() { return properties; }
    public void setProperties(List<PropertyBalanceDto> properties) { this.properties = properties; }

    // ─── Nested DTO : balance par propriete ──────────────────────────────────────

    public static class PropertyBalanceDto {
        private Long propertyId;
        private String propertyName;
        private BigDecimal unpaidAmount;
        private int interventionCount;
        private List<UnpaidInterventionDto> interventions;

        public PropertyBalanceDto() {}

        public Long getPropertyId() { return propertyId; }
        public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

        public String getPropertyName() { return propertyName; }
        public void setPropertyName(String propertyName) { this.propertyName = propertyName; }

        public BigDecimal getUnpaidAmount() { return unpaidAmount; }
        public void setUnpaidAmount(BigDecimal unpaidAmount) { this.unpaidAmount = unpaidAmount; }

        public int getInterventionCount() { return interventionCount; }
        public void setInterventionCount(int interventionCount) { this.interventionCount = interventionCount; }

        public List<UnpaidInterventionDto> getInterventions() { return interventions; }
        public void setInterventions(List<UnpaidInterventionDto> interventions) { this.interventions = interventions; }
    }

    // ─── Nested DTO : intervention impayee ───────────────────────────────────────

    public static class UnpaidInterventionDto {
        private Long id;
        private String title;
        private String scheduledDate;
        private BigDecimal estimatedCost;
        private String status;
        private String paymentStatus;

        public UnpaidInterventionDto() {}

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }

        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }

        public String getScheduledDate() { return scheduledDate; }
        public void setScheduledDate(String scheduledDate) { this.scheduledDate = scheduledDate; }

        public BigDecimal getEstimatedCost() { return estimatedCost; }
        public void setEstimatedCost(BigDecimal estimatedCost) { this.estimatedCost = estimatedCost; }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }

        public String getPaymentStatus() { return paymentStatus; }
        public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }
    }
}
