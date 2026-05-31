package com.clenzy.dto.voucher;

import com.clenzy.model.voucher.VoucherChannelScope;
import com.clenzy.model.voucher.VoucherDiscountType;
import com.clenzy.model.voucher.VoucherStatus;
import com.clenzy.model.voucher.VoucherType;
import com.clenzy.service.voucher.VoucherCreatePayload;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class BookingVoucherCreateRequestDtoTest {

    private static Validator validator;

    @BeforeAll
    static void setupValidator() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    // --- Accessors ---

    @Test
    void recordAccessors_returnAllConstructorValues() {
        Instant from = Instant.parse("2026-06-01T00:00:00Z");
        Instant until = Instant.parse("2026-09-01T00:00:00Z");
        List<Long> propertyIds = List.of(1L, 2L, 3L);

        BookingVoucherCreateRequestDto dto = new BookingVoucherCreateRequestDto(
                "Summer Sale",
                "Promo for summer 2026",
                "SUMMER2026",
                VoucherType.MANUAL_CODE,
                VoucherDiscountType.PERCENTAGE,
                new BigDecimal("15.00"),
                from,
                until,
                2,
                new BigDecimal("100.00"),
                14,
                500,
                1,
                VoucherChannelScope.BOOKING_ENGINE,
                VoucherStatus.ACTIVE,
                propertyIds
        );

        assertEquals("Summer Sale", dto.name());
        assertEquals("Promo for summer 2026", dto.description());
        assertEquals("SUMMER2026", dto.code());
        assertEquals(VoucherType.MANUAL_CODE, dto.type());
        assertEquals(VoucherDiscountType.PERCENTAGE, dto.discountType());
        assertEquals(new BigDecimal("15.00"), dto.discountValue());
        assertEquals(from, dto.validFrom());
        assertEquals(until, dto.validUntil());
        assertEquals(2, dto.minStayNights());
        assertEquals(new BigDecimal("100.00"), dto.minTotalAmount());
        assertEquals(14, dto.maxStayNights());
        assertEquals(500, dto.maxUsesTotal());
        assertEquals(1, dto.maxUsesPerGuest());
        assertEquals(VoucherChannelScope.BOOKING_ENGINE, dto.channelScope());
        assertEquals(VoucherStatus.ACTIVE, dto.status());
        assertEquals(propertyIds, dto.propertyIds());
    }

    // --- toPayload ---

    @Test
    void toPayload_mapsAllFields() {
        Instant from = Instant.parse("2026-06-01T00:00:00Z");
        Instant until = Instant.parse("2026-09-01T00:00:00Z");
        List<Long> propertyIds = List.of(10L);

        BookingVoucherCreateRequestDto dto = new BookingVoucherCreateRequestDto(
                "Camp", "desc", "CODE1", VoucherType.AUTO_CAMPAIGN,
                VoucherDiscountType.FIXED_AMOUNT, new BigDecimal("25.00"),
                from, until, 3, new BigDecimal("50.00"), 30,
                1000, 5, VoucherChannelScope.ALL, VoucherStatus.DRAFT, propertyIds
        );

        VoucherCreatePayload payload = dto.toPayload();

        assertEquals("Camp", payload.name());
        assertEquals("desc", payload.description());
        assertEquals("CODE1", payload.code());
        assertEquals(VoucherType.AUTO_CAMPAIGN, payload.type());
        assertEquals(VoucherDiscountType.FIXED_AMOUNT, payload.discountType());
        assertEquals(new BigDecimal("25.00"), payload.discountValue());
        assertEquals(from, payload.validFrom());
        assertEquals(until, payload.validUntil());
        assertEquals(3, payload.minStayNights());
        assertEquals(new BigDecimal("50.00"), payload.minTotalAmount());
        assertEquals(30, payload.maxStayNights());
        assertEquals(1000, payload.maxUsesTotal());
        assertEquals(5, payload.maxUsesPerGuest());
        assertEquals(VoucherChannelScope.ALL, payload.channelScope());
        assertEquals(VoucherStatus.DRAFT, payload.status());
        assertEquals(propertyIds, payload.propertyIds());
    }

    // --- Validation positive ---

    @Test
    void validation_validDto_noViolations() {
        BookingVoucherCreateRequestDto dto = validDto();
        Set<ConstraintViolation<BookingVoucherCreateRequestDto>> violations = validator.validate(dto);
        assertTrue(violations.isEmpty());
    }

    // --- Validation negative ---

    @Test
    void validation_blankName_hasViolation() {
        BookingVoucherCreateRequestDto dto = new BookingVoucherCreateRequestDto(
                "  ", null, null, VoucherType.MANUAL_CODE,
                VoucherDiscountType.PERCENTAGE, new BigDecimal("10.00"),
                null, null, null, null, null, null, null,
                null, null, null
        );
        Set<ConstraintViolation<BookingVoucherCreateRequestDto>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("name")));
    }

    @Test
    void validation_nameTooLong_hasViolation() {
        String longName = "A".repeat(151);
        BookingVoucherCreateRequestDto dto = new BookingVoucherCreateRequestDto(
                longName, null, null, VoucherType.MANUAL_CODE,
                VoucherDiscountType.PERCENTAGE, new BigDecimal("10.00"),
                null, null, null, null, null, null, null,
                null, null, null
        );
        Set<ConstraintViolation<BookingVoucherCreateRequestDto>> violations = validator.validate(dto);
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("name")));
    }

    @Test
    void validation_codeTooLong_hasViolation() {
        String longCode = "C".repeat(65);
        BookingVoucherCreateRequestDto dto = new BookingVoucherCreateRequestDto(
                "Valid", null, longCode, VoucherType.MANUAL_CODE,
                VoucherDiscountType.PERCENTAGE, new BigDecimal("10.00"),
                null, null, null, null, null, null, null,
                null, null, null
        );
        Set<ConstraintViolation<BookingVoucherCreateRequestDto>> violations = validator.validate(dto);
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("code")));
    }

    @Test
    void validation_typeNull_hasViolation() {
        BookingVoucherCreateRequestDto dto = new BookingVoucherCreateRequestDto(
                "Valid", null, null, null,
                VoucherDiscountType.PERCENTAGE, new BigDecimal("10.00"),
                null, null, null, null, null, null, null,
                null, null, null
        );
        Set<ConstraintViolation<BookingVoucherCreateRequestDto>> violations = validator.validate(dto);
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("type")));
    }

    @Test
    void validation_discountTypeNull_hasViolation() {
        BookingVoucherCreateRequestDto dto = new BookingVoucherCreateRequestDto(
                "Valid", null, null, VoucherType.MANUAL_CODE,
                null, new BigDecimal("10.00"),
                null, null, null, null, null, null, null,
                null, null, null
        );
        Set<ConstraintViolation<BookingVoucherCreateRequestDto>> violations = validator.validate(dto);
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("discountType")));
    }

    @Test
    void validation_discountValueNull_hasViolation() {
        BookingVoucherCreateRequestDto dto = new BookingVoucherCreateRequestDto(
                "Valid", null, null, VoucherType.MANUAL_CODE,
                VoucherDiscountType.PERCENTAGE, null,
                null, null, null, null, null, null, null,
                null, null, null
        );
        Set<ConstraintViolation<BookingVoucherCreateRequestDto>> violations = validator.validate(dto);
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("discountValue")));
    }

    @Test
    void validation_discountValueZero_hasViolation() {
        BookingVoucherCreateRequestDto dto = new BookingVoucherCreateRequestDto(
                "Valid", null, null, VoucherType.MANUAL_CODE,
                VoucherDiscountType.PERCENTAGE, BigDecimal.ZERO,
                null, null, null, null, null, null, null,
                null, null, null
        );
        Set<ConstraintViolation<BookingVoucherCreateRequestDto>> violations = validator.validate(dto);
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("discountValue")));
    }

    @Test
    void validation_minStayNightsZero_hasViolation() {
        BookingVoucherCreateRequestDto dto = new BookingVoucherCreateRequestDto(
                "Valid", null, null, VoucherType.MANUAL_CODE,
                VoucherDiscountType.PERCENTAGE, new BigDecimal("10.00"),
                null, null, 0, null, null, null, null,
                null, null, null
        );
        Set<ConstraintViolation<BookingVoucherCreateRequestDto>> violations = validator.validate(dto);
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("minStayNights")));
    }

    @Test
    void validation_minTotalAmountNegative_hasViolation() {
        BookingVoucherCreateRequestDto dto = new BookingVoucherCreateRequestDto(
                "Valid", null, null, VoucherType.MANUAL_CODE,
                VoucherDiscountType.PERCENTAGE, new BigDecimal("10.00"),
                null, null, null, new BigDecimal("-1.00"), null, null, null,
                null, null, null
        );
        Set<ConstraintViolation<BookingVoucherCreateRequestDto>> violations = validator.validate(dto);
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("minTotalAmount")));
    }

    @Test
    void validation_maxStayNightsZero_hasViolation() {
        BookingVoucherCreateRequestDto dto = new BookingVoucherCreateRequestDto(
                "Valid", null, null, VoucherType.MANUAL_CODE,
                VoucherDiscountType.PERCENTAGE, new BigDecimal("10.00"),
                null, null, null, null, 0, null, null,
                null, null, null
        );
        Set<ConstraintViolation<BookingVoucherCreateRequestDto>> violations = validator.validate(dto);
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("maxStayNights")));
    }

    @Test
    void validation_maxUsesTotalZero_hasViolation() {
        BookingVoucherCreateRequestDto dto = new BookingVoucherCreateRequestDto(
                "Valid", null, null, VoucherType.MANUAL_CODE,
                VoucherDiscountType.PERCENTAGE, new BigDecimal("10.00"),
                null, null, null, null, null, 0, null,
                null, null, null
        );
        Set<ConstraintViolation<BookingVoucherCreateRequestDto>> violations = validator.validate(dto);
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("maxUsesTotal")));
    }

    @Test
    void validation_maxUsesPerGuestZero_hasViolation() {
        BookingVoucherCreateRequestDto dto = new BookingVoucherCreateRequestDto(
                "Valid", null, null, VoucherType.MANUAL_CODE,
                VoucherDiscountType.PERCENTAGE, new BigDecimal("10.00"),
                null, null, null, null, null, null, 0,
                null, null, null
        );
        Set<ConstraintViolation<BookingVoucherCreateRequestDto>> violations = validator.validate(dto);
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("maxUsesPerGuest")));
    }

    // --- Helpers ---

    private BookingVoucherCreateRequestDto validDto() {
        return new BookingVoucherCreateRequestDto(
                "Valid Name", "description", "CODE",
                VoucherType.MANUAL_CODE, VoucherDiscountType.PERCENTAGE,
                new BigDecimal("10.00"),
                null, null, 1, new BigDecimal("0.00"), 30,
                100, 1, VoucherChannelScope.ALL, VoucherStatus.DRAFT, List.of()
        );
    }
}
