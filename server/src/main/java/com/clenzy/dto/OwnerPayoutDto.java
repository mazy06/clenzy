package com.clenzy.dto;

import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutGenerationType;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.model.PayoutMethod;

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
    PayoutGenerationType generationType,
    PayoutMethod payoutMethod,
    String stripeTransferId,
    String paymentReference,
    Instant paidAt,
    String failureReason,
    int retryCount,
    String notes,
    Instant createdAt
) {
    public static OwnerPayoutDto from(OwnerPayout p) {
        return from(p, null);
    }

    public static OwnerPayoutDto from(OwnerPayout p, String ownerName) {
        return new OwnerPayoutDto(
            p.getId(), p.getOwnerId(), ownerName, p.getPeriodStart(), p.getPeriodEnd(),
            p.getGrossRevenue(), p.getCommissionAmount(), p.getCommissionRate(),
            p.getExpenses(), p.getNetAmount(), p.getStatus(), p.getGenerationType(),
            p.getPayoutMethod(), p.getStripeTransferId(),
            p.getPaymentReference(), p.getPaidAt(), p.getFailureReason(),
            p.getRetryCount(), p.getNotes(), p.getCreatedAt()
        );
    }
}
