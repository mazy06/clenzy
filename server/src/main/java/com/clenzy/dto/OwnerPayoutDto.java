package com.clenzy.dto;

import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record OwnerPayoutDto(
    Long id,
    Long ownerId,
    String ownerName,
    LocalDate periodStart,
    LocalDate periodEnd,
    BigDecimal grossRevenue,
    BigDecimal commissionAmount,
    BigDecimal commissionRate,
    BigDecimal expenses,
    BigDecimal netAmount,
    PayoutStatus status,
    String paymentReference,
    Instant paidAt,
    String notes,
    Instant createdAt
) {
    /**
     * Conversion sans resolution du nom (retro-compatible).
     */
    public static OwnerPayoutDto from(OwnerPayout p) {
        return new OwnerPayoutDto(
            p.getId(), p.getOwnerId(), null, p.getPeriodStart(), p.getPeriodEnd(),
            p.getGrossRevenue(), p.getCommissionAmount(), p.getCommissionRate(),
            p.getExpenses(), p.getNetAmount(), p.getStatus(),
            p.getPaymentReference(), p.getPaidAt(), p.getNotes(), p.getCreatedAt()
        );
    }

    /**
     * Conversion avec nom du proprietaire resolu.
     */
    public static OwnerPayoutDto from(OwnerPayout p, String ownerName) {
        return new OwnerPayoutDto(
            p.getId(), p.getOwnerId(), ownerName, p.getPeriodStart(), p.getPeriodEnd(),
            p.getGrossRevenue(), p.getCommissionAmount(), p.getCommissionRate(),
            p.getExpenses(), p.getNetAmount(), p.getStatus(),
            p.getPaymentReference(), p.getPaidAt(), p.getNotes(), p.getCreatedAt()
        );
    }
}
