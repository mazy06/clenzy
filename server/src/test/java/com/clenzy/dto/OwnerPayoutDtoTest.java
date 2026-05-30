package com.clenzy.dto;

import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutGenerationType;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.model.PayoutMethod;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class OwnerPayoutDtoTest {

    // --- Canonical record accessors ---

    @Test
    void canonicalConstructor_exposesAllFields() {
        LocalDate start = LocalDate.of(2026, 5, 1);
        LocalDate end = LocalDate.of(2026, 5, 31);
        Instant paidAt = Instant.parse("2026-06-05T10:00:00Z");
        Instant createdAt = Instant.parse("2026-06-01T00:00:00Z");

        OwnerPayoutDto dto = new OwnerPayoutDto(
                1L, 42L, "Jean Dupont", start, end,
                new BigDecimal("1000.00"), new BigDecimal("100.00"),
                new BigDecimal("0.1000"), new BigDecimal("50.00"),
                new BigDecimal("850.00"),
                PayoutStatus.PAID, PayoutGenerationType.AUTO,
                PayoutMethod.STRIPE_CONNECT, "tr_123",
                "REF-001", paidAt, null, 0, "OK", createdAt
        );

        assertEquals(1L, dto.id());
        assertEquals(42L, dto.ownerId());
        assertEquals("Jean Dupont", dto.ownerName());
        assertEquals(start, dto.periodStart());
        assertEquals(end, dto.periodEnd());
        assertEquals(new BigDecimal("1000.00"), dto.grossRevenue());
        assertEquals(new BigDecimal("100.00"), dto.commissionAmount());
        assertEquals(new BigDecimal("0.1000"), dto.commissionRate());
        assertEquals(new BigDecimal("50.00"), dto.expenses());
        assertEquals(new BigDecimal("850.00"), dto.netAmount());
        assertEquals(PayoutStatus.PAID, dto.status());
        assertEquals(PayoutGenerationType.AUTO, dto.generationType());
        assertEquals(PayoutMethod.STRIPE_CONNECT, dto.payoutMethod());
        assertEquals("tr_123", dto.stripeTransferId());
        assertEquals("REF-001", dto.paymentReference());
        assertEquals(paidAt, dto.paidAt());
        assertNull(dto.failureReason());
        assertEquals(0, dto.retryCount());
        assertEquals("OK", dto.notes());
        assertEquals(createdAt, dto.createdAt());
    }

    // --- from(entity) — single-arg passes null owner name ---

    @Test
    void from_singleArg_setsOwnerNameToNull() {
        OwnerPayout p = buildEntity();

        OwnerPayoutDto dto = OwnerPayoutDto.from(p);

        assertEquals(7L, dto.id());
        assertEquals(42L, dto.ownerId());
        assertNull(dto.ownerName());
        assertEquals(p.getPeriodStart(), dto.periodStart());
        assertEquals(p.getPeriodEnd(), dto.periodEnd());
        assertEquals(p.getGrossRevenue(), dto.grossRevenue());
        assertEquals(p.getCommissionAmount(), dto.commissionAmount());
        assertEquals(p.getCommissionRate(), dto.commissionRate());
        assertEquals(p.getExpenses(), dto.expenses());
        assertEquals(p.getNetAmount(), dto.netAmount());
        assertEquals(p.getStatus(), dto.status());
        assertEquals(p.getGenerationType(), dto.generationType());
        assertEquals(p.getPayoutMethod(), dto.payoutMethod());
        assertEquals(p.getStripeTransferId(), dto.stripeTransferId());
        assertEquals(p.getPaymentReference(), dto.paymentReference());
        assertEquals(p.getPaidAt(), dto.paidAt());
        assertEquals(p.getFailureReason(), dto.failureReason());
        assertEquals(p.getRetryCount(), dto.retryCount());
        assertEquals(p.getNotes(), dto.notes());
    }

    @Test
    void from_twoArg_setsProvidedOwnerName() {
        OwnerPayout p = buildEntity();

        OwnerPayoutDto dto = OwnerPayoutDto.from(p, "Alice Martin");

        assertEquals("Alice Martin", dto.ownerName());
        assertEquals(p.getId(), dto.id());
        assertEquals(p.getOwnerId(), dto.ownerId());
    }

    @Test
    void from_twoArg_acceptsNullOwnerName() {
        OwnerPayout p = buildEntity();

        OwnerPayoutDto dto = OwnerPayoutDto.from(p, null);

        assertNull(dto.ownerName());
    }

    @Test
    void from_withFailedPayout_carriesFailureMetadata() {
        OwnerPayout p = buildEntity();
        p.setStatus(PayoutStatus.FAILED);
        p.setFailureReason("SCA expired");
        p.setRetryCount(3);
        p.setPaidAt(null);

        OwnerPayoutDto dto = OwnerPayoutDto.from(p);

        assertEquals(PayoutStatus.FAILED, dto.status());
        assertEquals("SCA expired", dto.failureReason());
        assertEquals(3, dto.retryCount());
        assertNull(dto.paidAt());
    }

    // --- Record equality ---

    @Test
    void records_equalityByValue() {
        OwnerPayout p = buildEntity();
        OwnerPayoutDto a = OwnerPayoutDto.from(p, "X");
        OwnerPayoutDto b = OwnerPayoutDto.from(p, "X");

        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }

    @Test
    void records_inequalityByOwnerName() {
        OwnerPayout p = buildEntity();
        OwnerPayoutDto a = OwnerPayoutDto.from(p, "X");
        OwnerPayoutDto b = OwnerPayoutDto.from(p, "Y");

        assertNotEquals(a, b);
    }

    // --- Helpers ---

    private OwnerPayout buildEntity() {
        OwnerPayout p = new OwnerPayout();
        p.setId(7L);
        p.setOrganizationId(1L);
        p.setOwnerId(42L);
        p.setPeriodStart(LocalDate.of(2026, 4, 1));
        p.setPeriodEnd(LocalDate.of(2026, 4, 30));
        p.setGrossRevenue(new BigDecimal("500.00"));
        p.setCommissionAmount(new BigDecimal("50.00"));
        p.setCommissionRate(new BigDecimal("0.1000"));
        p.setExpenses(new BigDecimal("20.00"));
        p.setNetAmount(new BigDecimal("430.00"));
        p.setStatus(PayoutStatus.PENDING);
        p.setGenerationType(PayoutGenerationType.MANUAL);
        p.setPayoutMethod(PayoutMethod.SEPA_TRANSFER);
        p.setStripeTransferId(null);
        p.setPaymentReference("PR-1");
        p.setPaidAt(null);
        p.setFailureReason(null);
        p.setRetryCount(0);
        p.setNotes("note");
        return p;
    }
}
