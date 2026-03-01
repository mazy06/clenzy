package com.clenzy.dto;

import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record OwnerPayoutDto(
    Long id,
    Long ownerId,
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
    public static OwnerPayoutDto from(OwnerPayout p) {
        return new OwnerPayoutDto(
            p.getId(), p.getOwnerId(), p.getPeriodStart(), p.getPeriodEnd(),
            p.getGrossRevenue(), p.getCommissionAmount(), p.getCommissionRate(),
            p.getExpenses(), p.getNetAmount(), p.getStatus(),
            p.getPaymentReference(), p.getPaidAt(), p.getNotes(), p.getCreatedAt()
        );
    }
}
