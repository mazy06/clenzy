package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Commission d'affiliation d'activité attribuée à une org/réservation, avec la
 * répartition part hôte / part plateforme (cf. {@code ActivityCommissionConfig}).
 * Alimentée par le reporting fournisseur (Viator…) quand il est branché. Toujours
 * interrogée par org explicite (pas de filtre tenant).
 */
@Entity
@Table(name = "activity_commissions", indexes = {
        @Index(name = "idx_activity_commissions_org", columnList = "organization_id"),
        @Index(name = "idx_activity_commissions_reservation", columnList = "reservation_id")
})
public class ActivityCommission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "reservation_id")
    private Long reservationId;

    @Column(name = "guide_id")
    private Long guideId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ActivityProvider provider;

    @Column(name = "external_booking_id", length = 255)
    private String externalBookingId;

    @Column(name = "gross_commission", nullable = false, precision = 12, scale = 2)
    private BigDecimal grossCommission;

    @Column(name = "host_share", nullable = false, precision = 12, scale = 2)
    private BigDecimal hostShare;

    @Column(name = "platform_share", nullable = false, precision = 12, scale = 2)
    private BigDecimal platformShare;

    @Column(nullable = false, length = 3)
    private String currency = "EUR";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ActivityCommissionStatus status = ActivityCommissionStatus.PENDING;

    @Column(name = "property_id")
    private Long propertyId;
    @Column(name = "beneficiary_owner_id")
    private Long beneficiaryOwnerId;
    @Column(name = "receipt_reference", length = 255)
    private String receiptReference;
    @Column(name = "received_at")
    private LocalDateTime receivedAt;
    @Column(name = "recorded_by", length = 255)
    private String recordedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public Long getReservationId() { return reservationId; }
    public void setReservationId(Long reservationId) { this.reservationId = reservationId; }
    public Long getGuideId() { return guideId; }
    public void setGuideId(Long guideId) { this.guideId = guideId; }
    public ActivityProvider getProvider() { return provider; }
    public void setProvider(ActivityProvider provider) { this.provider = provider; }
    public String getExternalBookingId() { return externalBookingId; }
    public void setExternalBookingId(String externalBookingId) { this.externalBookingId = externalBookingId; }
    public BigDecimal getGrossCommission() { return grossCommission; }
    public void setGrossCommission(BigDecimal grossCommission) { this.grossCommission = grossCommission; }
    public BigDecimal getHostShare() { return hostShare; }
    public void setHostShare(BigDecimal hostShare) { this.hostShare = hostShare; }
    public BigDecimal getPlatformShare() { return platformShare; }
    public void setPlatformShare(BigDecimal platformShare) { this.platformShare = platformShare; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public ActivityCommissionStatus getStatus() { return status; }
    public void setStatus(ActivityCommissionStatus status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long value) { propertyId = value; }
    public Long getBeneficiaryOwnerId() { return beneficiaryOwnerId; }
    public void setBeneficiaryOwnerId(Long value) { beneficiaryOwnerId = value; }
    public String getReceiptReference() { return receiptReference; }
    public void setReceiptReference(String value) { receiptReference = value; }
    public LocalDateTime getReceivedAt() { return receivedAt; }
    public void setReceivedAt(LocalDateTime value) { receivedAt = value; }
    public String getRecordedBy() { return recordedBy; }
    public void setRecordedBy(String value) { recordedBy = value; }
}
