package com.clenzy.dto;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class BillingSummaryDtoTest {

    @Test
    void defaultConstructor_allZeroAndNullStrings() {
        BillingSummaryDto dto = new BillingSummaryDto();

        assertEquals(0, dto.getMemberCount());
        assertEquals(0, dto.getFreeSeats());
        assertEquals(0, dto.getBillableSeats());
        assertEquals(0, dto.getBasePriceCents());
        assertEquals(0, dto.getPerSeatPriceCents());
        assertEquals(0, dto.getSeatsTotalCents());
        assertEquals(0, dto.getTotalMonthlyCents());
        assertNull(dto.getBillingPeriod());
        assertEquals(0.0, dto.getBillingPeriodDiscount());
        assertEquals(0, dto.getEffectiveMonthlyCents());
    }

    @Test
    void allArgsConstructor_setsEveryField() {
        BillingSummaryDto dto = new BillingSummaryDto(
                10, 3, 7,
                500, 200,
                1400, 1900,
                "ANNUAL", 0.15,
                1615
        );

        assertEquals(10, dto.getMemberCount());
        assertEquals(3, dto.getFreeSeats());
        assertEquals(7, dto.getBillableSeats());
        assertEquals(500, dto.getBasePriceCents());
        assertEquals(200, dto.getPerSeatPriceCents());
        assertEquals(1400, dto.getSeatsTotalCents());
        assertEquals(1900, dto.getTotalMonthlyCents());
        assertEquals("ANNUAL", dto.getBillingPeriod());
        assertEquals(0.15, dto.getBillingPeriodDiscount());
        assertEquals(1615, dto.getEffectiveMonthlyCents());
    }

    @Test
    void settersAndGetters_roundtripAllFields() {
        BillingSummaryDto dto = new BillingSummaryDto();

        dto.setMemberCount(12);
        dto.setFreeSeats(2);
        dto.setBillableSeats(10);
        dto.setBasePriceCents(1000);
        dto.setPerSeatPriceCents(150);
        dto.setSeatsTotalCents(1500);
        dto.setTotalMonthlyCents(2500);
        dto.setBillingPeriod("MONTHLY");
        dto.setBillingPeriodDiscount(0.0);
        dto.setEffectiveMonthlyCents(2500);

        assertEquals(12, dto.getMemberCount());
        assertEquals(2, dto.getFreeSeats());
        assertEquals(10, dto.getBillableSeats());
        assertEquals(1000, dto.getBasePriceCents());
        assertEquals(150, dto.getPerSeatPriceCents());
        assertEquals(1500, dto.getSeatsTotalCents());
        assertEquals(2500, dto.getTotalMonthlyCents());
        assertEquals("MONTHLY", dto.getBillingPeriod());
        assertEquals(0.0, dto.getBillingPeriodDiscount());
        assertEquals(2500, dto.getEffectiveMonthlyCents());
    }

    @Test
    void settersAcceptNegativeAndZero() {
        BillingSummaryDto dto = new BillingSummaryDto();

        dto.setMemberCount(-1);
        dto.setFreeSeats(0);
        dto.setBillingPeriodDiscount(-0.05);

        assertEquals(-1, dto.getMemberCount());
        assertEquals(0, dto.getFreeSeats());
        assertEquals(-0.05, dto.getBillingPeriodDiscount());
    }

    @Test
    void setBillingPeriod_acceptsNull() {
        BillingSummaryDto dto = new BillingSummaryDto();
        dto.setBillingPeriod("ANNUAL");
        dto.setBillingPeriod(null);

        assertNull(dto.getBillingPeriod());
    }

    @Test
    void billingPeriodDiscount_acceptsDoublePrecision() {
        BillingSummaryDto dto = new BillingSummaryDto();
        dto.setBillingPeriodDiscount(0.123456789);

        assertEquals(0.123456789, dto.getBillingPeriodDiscount(), 1e-12);
    }
}
