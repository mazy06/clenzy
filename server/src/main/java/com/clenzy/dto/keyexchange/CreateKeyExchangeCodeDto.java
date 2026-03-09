package com.clenzy.dto.keyexchange;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

public class CreateKeyExchangeCodeDto {

    @NotNull(message = "Le point d'echange est requis")
    private Long pointId;

    @Size(max = 255, message = "Le nom du voyageur ne peut pas depasser 255 caracteres")
    private String guestName;

    /** COLLECTION ou DROP_OFF */
    private String codeType;

    private Long reservationId;

    private LocalDateTime validFrom;

    private LocalDateTime validUntil;

    // ─── Getters / Setters ──────────────────────────────────────

    public Long getPointId() { return pointId; }
    public void setPointId(Long pointId) { this.pointId = pointId; }

    public String getGuestName() { return guestName; }
    public void setGuestName(String guestName) { this.guestName = guestName; }

    public String getCodeType() { return codeType; }
    public void setCodeType(String codeType) { this.codeType = codeType; }

    public Long getReservationId() { return reservationId; }
    public void setReservationId(Long reservationId) { this.reservationId = reservationId; }

    public LocalDateTime getValidFrom() { return validFrom; }
    public void setValidFrom(LocalDateTime validFrom) { this.validFrom = validFrom; }

    public LocalDateTime getValidUntil() { return validUntil; }
    public void setValidUntil(LocalDateTime validUntil) { this.validUntil = validUntil; }
}
