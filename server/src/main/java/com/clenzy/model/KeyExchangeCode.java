package com.clenzy.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "key_exchange_codes", indexes = {
    @Index(name = "idx_kec_org", columnList = "organization_id"),
    @Index(name = "idx_kec_point", columnList = "point_id"),
    @Index(name = "idx_kec_property", columnList = "property_id"),
    @Index(name = "idx_kec_reservation", columnList = "reservation_id"),
    @Index(name = "idx_kec_status", columnList = "status"),
    @Index(name = "idx_kec_created", columnList = "created_at DESC")
})
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class KeyExchangeCode {

    // ─── Enums ──────────────────────────────────────────────────

    public enum CodeType {
        COLLECTION, DROP_OFF
    }

    public enum CodeStatus {
        ACTIVE, USED, EXPIRED, CANCELLED
    }

    // ─── Fields ─────────────────────────────────────────────────

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "point_id", nullable = false)
    private Long pointId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Column(name = "reservation_id")
    private Long reservationId;

    @Column(name = "guest_name")
    private String guestName;

    @Column(name = "code", nullable = false, length = 100)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(name = "code_type", nullable = false, length = 20)
    private CodeType codeType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private CodeStatus status = CodeStatus.ACTIVE;

    @Column(name = "valid_from")
    private LocalDateTime validFrom;

    @Column(name = "valid_until")
    private LocalDateTime validUntil;

    @Column(name = "collected_at")
    private LocalDateTime collectedAt;

    @Column(name = "returned_at")
    private LocalDateTime returnedAt;

    @Column(name = "provider_code_id", length = 100)
    private String providerCodeId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // ─── Relations ──────────────────────────────────────────────

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "point_id", insertable = false, updatable = false)
    private KeyExchangePoint point;

    // ─── Lifecycle ──────────────────────────────────────────────

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // ─── Getters / Setters ──────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getPointId() { return pointId; }
    public void setPointId(Long pointId) { this.pointId = pointId; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public Long getReservationId() { return reservationId; }
    public void setReservationId(Long reservationId) { this.reservationId = reservationId; }

    public String getGuestName() { return guestName; }
    public void setGuestName(String guestName) { this.guestName = guestName; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public CodeType getCodeType() { return codeType; }
    public void setCodeType(CodeType codeType) { this.codeType = codeType; }

    public CodeStatus getStatus() { return status; }
    public void setStatus(CodeStatus status) { this.status = status; }

    public LocalDateTime getValidFrom() { return validFrom; }
    public void setValidFrom(LocalDateTime validFrom) { this.validFrom = validFrom; }

    public LocalDateTime getValidUntil() { return validUntil; }
    public void setValidUntil(LocalDateTime validUntil) { this.validUntil = validUntil; }

    public LocalDateTime getCollectedAt() { return collectedAt; }
    public void setCollectedAt(LocalDateTime collectedAt) { this.collectedAt = collectedAt; }

    public LocalDateTime getReturnedAt() { return returnedAt; }
    public void setReturnedAt(LocalDateTime returnedAt) { this.returnedAt = returnedAt; }

    public String getProviderCodeId() { return providerCodeId; }
    public void setProviderCodeId(String providerCodeId) { this.providerCodeId = providerCodeId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public KeyExchangePoint getPoint() { return point; }
}
