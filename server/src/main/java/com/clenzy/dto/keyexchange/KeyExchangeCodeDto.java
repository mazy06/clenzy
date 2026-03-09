package com.clenzy.dto.keyexchange;

import java.time.LocalDateTime;

public class KeyExchangeCodeDto {

    private Long id;
    private Long pointId;
    private String pointName;
    private Long propertyId;
    private Long reservationId;
    private String guestName;
    private String code;
    private String codeType;
    private String status;
    private LocalDateTime validFrom;
    private LocalDateTime validUntil;
    private LocalDateTime collectedAt;
    private LocalDateTime returnedAt;
    private String providerCodeId;
    private LocalDateTime createdAt;

    // ─── Getters / Setters ──────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getPointId() { return pointId; }
    public void setPointId(Long pointId) { this.pointId = pointId; }

    public String getPointName() { return pointName; }
    public void setPointName(String pointName) { this.pointName = pointName; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public Long getReservationId() { return reservationId; }
    public void setReservationId(Long reservationId) { this.reservationId = reservationId; }

    public String getGuestName() { return guestName; }
    public void setGuestName(String guestName) { this.guestName = guestName; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getCodeType() { return codeType; }
    public void setCodeType(String codeType) { this.codeType = codeType; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

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
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
