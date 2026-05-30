package com.clenzy.dto.voucher;

import com.clenzy.model.BookingVoucher;
import com.clenzy.model.voucher.VoucherChannelScope;
import com.clenzy.model.voucher.VoucherCreatorOrgType;
import com.clenzy.model.voucher.VoucherDiscountType;
import com.clenzy.model.voucher.VoucherStatus;
import com.clenzy.model.voucher.VoucherType;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class BookingVoucherDtoTest {

    // --- Canonical record accessors ---

    @Test
    void canonicalConstructor_exposesAllFields() {
        Instant validFrom = Instant.parse("2026-01-01T00:00:00Z");
        Instant validUntil = Instant.parse("2026-12-31T23:59:59Z");
        Instant createdAt = Instant.parse("2025-12-01T00:00:00Z");
        Instant updatedAt = Instant.parse("2025-12-15T00:00:00Z");
        Set<Long> propertyIds = Set.of(100L, 200L);

        BookingVoucherDto dto = new BookingVoucherDto(
                1L, 10L, "Black Friday", "Promo BF26",
                "BF26", VoucherType.MANUAL_CODE,
                VoucherDiscountType.PERCENTAGE, new BigDecimal("20.00"),
                validFrom, validUntil,
                2, new BigDecimal("100.00"), 7,
                1000, 1, 42,
                VoucherChannelScope.ALL, VoucherStatus.ACTIVE,
                VoucherCreatorOrgType.HOST, 99L,
                propertyIds, createdAt, updatedAt
        );

        assertEquals(1L, dto.id());
        assertEquals(10L, dto.organizationId());
        assertEquals("Black Friday", dto.name());
        assertEquals("Promo BF26", dto.description());
        assertEquals("BF26", dto.code());
        assertEquals(VoucherType.MANUAL_CODE, dto.type());
        assertEquals(VoucherDiscountType.PERCENTAGE, dto.discountType());
        assertEquals(new BigDecimal("20.00"), dto.discountValue());
        assertEquals(validFrom, dto.validFrom());
        assertEquals(validUntil, dto.validUntil());
        assertEquals(2, dto.minStayNights());
        assertEquals(new BigDecimal("100.00"), dto.minTotalAmount());
        assertEquals(7, dto.maxStayNights());
        assertEquals(1000, dto.maxUsesTotal());
        assertEquals(1, dto.maxUsesPerGuest());
        assertEquals(42, dto.usageCount());
        assertEquals(VoucherChannelScope.ALL, dto.channelScope());
        assertEquals(VoucherStatus.ACTIVE, dto.status());
        assertEquals(VoucherCreatorOrgType.HOST, dto.createdByOrgType());
        assertEquals(99L, dto.createdByUserId());
        assertEquals(propertyIds, dto.propertyIds());
        assertEquals(createdAt, dto.createdAt());
        assertEquals(updatedAt, dto.updatedAt());
    }

    // --- from(entity, propertyIds) factory ---

    @Test
    void from_copiesAllEntityFieldsAndInjectsPropertyIds() {
        Instant validFrom = Instant.parse("2026-03-01T00:00:00Z");
        Instant validUntil = Instant.parse("2026-04-01T00:00:00Z");

        BookingVoucher v = new BookingVoucher();
        v.setId(7L);
        v.setOrganizationId(123L);
        v.setName("Spring sale");
        v.setDescription("desc");
        v.setCode("SPRING");
        v.setType(VoucherType.AUTO_CAMPAIGN);
        v.setDiscountType(VoucherDiscountType.FIXED_AMOUNT);
        v.setDiscountValue(new BigDecimal("15.00"));
        v.setValidFrom(validFrom);
        v.setValidUntil(validUntil);
        v.setMinStayNights(3);
        v.setMinTotalAmount(new BigDecimal("50.00"));
        v.setMaxStayNights(14);
        v.setMaxUsesTotal(500);
        v.setMaxUsesPerGuest(2);
        v.setUsageCount(10);
        v.setChannelScope(VoucherChannelScope.WHATSAPP);
        v.setStatus(VoucherStatus.PAUSED);
        v.setCreatedByOrgType(VoucherCreatorOrgType.MANAGEMENT_ORG);
        v.setCreatedByUserId(33L);

        Set<Long> propertyIds = Set.of(1L, 2L, 3L);
        BookingVoucherDto dto = BookingVoucherDto.from(v, propertyIds);

        assertEquals(7L, dto.id());
        assertEquals(123L, dto.organizationId());
        assertEquals("Spring sale", dto.name());
        assertEquals("desc", dto.description());
        assertEquals("SPRING", dto.code());
        assertEquals(VoucherType.AUTO_CAMPAIGN, dto.type());
        assertEquals(VoucherDiscountType.FIXED_AMOUNT, dto.discountType());
        assertEquals(new BigDecimal("15.00"), dto.discountValue());
        assertEquals(validFrom, dto.validFrom());
        assertEquals(validUntil, dto.validUntil());
        assertEquals(3, dto.minStayNights());
        assertEquals(new BigDecimal("50.00"), dto.minTotalAmount());
        assertEquals(14, dto.maxStayNights());
        assertEquals(500, dto.maxUsesTotal());
        assertEquals(2, dto.maxUsesPerGuest());
        assertEquals(10, dto.usageCount());
        assertEquals(VoucherChannelScope.WHATSAPP, dto.channelScope());
        assertEquals(VoucherStatus.PAUSED, dto.status());
        assertEquals(VoucherCreatorOrgType.MANAGEMENT_ORG, dto.createdByOrgType());
        assertEquals(33L, dto.createdByUserId());
        assertEquals(propertyIds, dto.propertyIds());
    }

    @Test
    void from_withEmptyPropertyIds_keepsEmptySet() {
        BookingVoucher v = new BookingVoucher();
        v.setName("name");
        v.setType(VoucherType.MANUAL_CODE);
        v.setDiscountType(VoucherDiscountType.PERCENTAGE);
        v.setDiscountValue(BigDecimal.ONE);

        BookingVoucherDto dto = BookingVoucherDto.from(v, Set.of());

        assertTrue(dto.propertyIds().isEmpty());
    }

    @Test
    void from_passesThroughNullPropertyIds() {
        BookingVoucher v = new BookingVoucher();
        v.setName("name");
        v.setType(VoucherType.MANUAL_CODE);
        v.setDiscountType(VoucherDiscountType.PERCENTAGE);
        v.setDiscountValue(BigDecimal.ONE);

        BookingVoucherDto dto = BookingVoucherDto.from(v, null);

        assertNull(dto.propertyIds());
    }

    // --- Record equality ---

    @Test
    void records_equalityByValue() {
        BookingVoucherDto a = new BookingVoucherDto(
                1L, 10L, "x", null, "C", VoucherType.MANUAL_CODE,
                VoucherDiscountType.PERCENTAGE, BigDecimal.TEN,
                null, null, null, null, null, null, null, 0,
                VoucherChannelScope.ALL, VoucherStatus.DRAFT,
                VoucherCreatorOrgType.HOST, null, Set.of(), null, null
        );
        BookingVoucherDto b = new BookingVoucherDto(
                1L, 10L, "x", null, "C", VoucherType.MANUAL_CODE,
                VoucherDiscountType.PERCENTAGE, BigDecimal.TEN,
                null, null, null, null, null, null, null, 0,
                VoucherChannelScope.ALL, VoucherStatus.DRAFT,
                VoucherCreatorOrgType.HOST, null, Set.of(), null, null
        );
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }
}
