package com.clenzy.dto.smartlock;

import com.clenzy.model.SmartLockAccessCode;
import java.time.LocalDateTime;

/**
 * Vue d'un code d'acces de serrure pour le hub. Le {@code code} (PIN) n'est expose
 * qu'aux roles autorises (endpoint role-gate) — donnee sensible d'acces physique.
 */
public record SmartLockAccessCodeDto(
        Long id,
        Long deviceId,
        Long reservationId,
        String code,
        String name,
        LocalDateTime validFrom,
        LocalDateTime validUntil,
        String status,
        String source,
        LocalDateTime createdAt
) {
    public static SmartLockAccessCodeDto from(SmartLockAccessCode c) {
        return new SmartLockAccessCodeDto(
                c.getId(), c.getDeviceId(), c.getReservationId(), c.getCode(), c.getName(),
                c.getValidFrom(), c.getValidUntil(),
                c.getStatus() != null ? c.getStatus().name() : null,
                c.getSource() != null ? c.getSource().name() : null,
                c.getCreatedAt());
    }
}
