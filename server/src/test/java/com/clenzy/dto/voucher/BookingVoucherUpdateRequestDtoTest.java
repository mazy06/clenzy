package com.clenzy.dto.voucher;

import com.clenzy.model.voucher.VoucherChannelScope;
import com.clenzy.model.voucher.VoucherDiscountType;
import com.clenzy.model.voucher.VoucherStatus;
import com.clenzy.service.voucher.VoucherUpdatePayload;
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

class BookingVoucherUpdateRequestDtoTest {

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
        List<Long> propertyIds = List.of(5L, 6L);

        BookingVoucherUpdateRequestDto dto = new BookingVoucherUpdateRequestDto(
                "Updated Name", "Updated description", "NEWCODE",
                VoucherDiscountType.FIXED_AMOUNT, new BigDecimal("20.00"),
                from, until, 3, new BigDecimal("75.00"), 14,
                250, 2, VoucherChannelScope.WHATSAPP, VoucherStatus.PAUSED,
                propertyIds
        );

        assertEquals("Updated Name", dto.name());
        assertEquals("Updated description", dto.description());
        assertEquals("NEWCODE", dto.code());
        assertEquals(VoucherDiscountType.FIXED_AMOUNT, dto.discountType());
        assertEquals(new BigDecimal("20.00"), dto.discountValue());
        assertEquals(from, dto.validFrom());
        assertEquals(until, dto.validUntil());
        assertEquals(3, dto.minStayNights());
        assertEquals(new BigDecimal("75.00"), dto.minTotalAmount());
        assertEquals(14, dto.maxStayNights());
        assertEquals(250, dto.maxUsesTotal());
        assertEquals(2, dto.maxUsesPerGuest());
        assertEquals(VoucherChannelScope.WHATSAPP, dto.channelScope());
        assertEquals(VoucherStatus.PAUSED, dto.status());
        assertEquals(propertyIds, dto.propertyIds());
    }

    @Test
    void allNulls_isValid() {
        BookingVoucherUpdateRequestDto dto = new BookingVoucherUpdateRequestDto(
                null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null
        );
        Set<ConstraintViolation<BookingVoucherUpdateRequestDto>> violations = validator.validate(dto);
        assertTrue(violations.isEmpty());
    }

    // --- toPayload ---

    @Test
    void toPayload_mapsAllFields() {
        Instant from = Instant.parse("2026-06-01T00:00:00Z");
        List<Long> propertyIds = List.of(99L);

        BookingVoucherUpdateRequestDto dto = new BookingVoucherUpdateRequestDto(
                "name", "desc", "CODE",
                VoucherDiscountType.PERCENTAGE, new BigDecimal("12.50"),
                from, null, 2, new BigDecimal("60.00"), 21,
                1000, 1, VoucherChannelScope.EMAIL, VoucherStatus.ACTIVE,
                propertyIds
        );

        VoucherUpdatePayload payload = dto.toPayload();

        assertEquals("name", payload.name());
        assertEquals("desc", payload.description());
        assertEquals("CODE", payload.code());
        assertEquals(VoucherDiscountType.PERCENTAGE, payload.discountType());
        assertEquals(new BigDecimal("12.50"), payload.discountValue());
        assertEquals(from, payload.validFrom());
        assertNull(payload.validUntil());
        assertEquals(2, payload.minStayNights());
        assertEquals(new BigDecimal("60.00"), payload.minTotalAmount());
        assertEquals(21, payload.maxStayNights());
        assertEquals(1000, payload.maxUsesTotal());
        assertEquals(1, payload.maxUsesPerGuest());
        assertEquals(VoucherChannelScope.EMAIL, payload.channelScope());
        assertEquals(VoucherStatus.ACTIVE, payload.status());
        assertEquals(propertyIds, payload.propertyIds());
    }

    // --- Validation negative ---

    @Test
    void validation_nameTooLong_hasViolation() {
        BookingVoucherUpdateRequestDto dto = new BookingVoucherUpdateRequestDto(
                "A".repeat(151), null, null, null, null, null, null,
                null, null, null, null, null, null, null, null
        );
        Set<ConstraintViolation<BookingVoucherUpdateRequestDto>> violations = validator.validate(dto);
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("name")));
    }

    @Test
    void validation_codeTooLong_hasViolation() {
        BookingVoucherUpdateRequestDto dto = new BookingVoucherUpdateRequestDto(
                null, null, "C".repeat(65), null, null, null, null,
                null, null, null, null, null, null, null, null
        );
        Set<ConstraintViolation<BookingVoucherUpdateRequestDto>> violations = validator.validate(dto);
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("code")));
    }

    @Test
    void validation_discountValueZero_hasViolation() {
        BookingVoucherUpdateRequestDto dto = new BookingVoucherUpdateRequestDto(
                null, null, null, null, BigDecimal.ZERO, null, null,
                null, null, null, null, null, null, null, null
        );
        Set<ConstraintViolation<BookingVoucherUpdateRequestDto>> violations = validator.validate(dto);
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("discountValue")));
    }

    @Test
    void validation_minStayNightsZero_hasViolation() {
        BookingVoucherUpdateRequestDto dto = new BookingVoucherUpdateRequestDto(
                null, null, null, null, null, null, null,
                0, null, null, null, null, null, null, null
        );
        Set<ConstraintViolation<BookingVoucherUpdateRequestDto>> violations = validator.validate(dto);
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("minStayNights")));
    }

    @Test
    void validation_minTotalAmountNegative_hasViolation() {
        BookingVoucherUpdateRequestDto dto = new BookingVoucherUpdateRequestDto(
                null, null, null, null, null, null, null,
                null, new BigDecimal("-0.01"), null, null, null, null, null, null
        );
        Set<ConstraintViolation<BookingVoucherUpdateRequestDto>> violations = validator.validate(dto);
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("minTotalAmount")));
    }

    @Test
    void validation_maxStayNightsZero_hasViolation() {
        BookingVoucherUpdateRequestDto dto = new BookingVoucherUpdateRequestDto(
                null, null, null, null, null, null, null,
                null, null, 0, null, null, null, null, null
        );
        Set<ConstraintViolation<BookingVoucherUpdateRequestDto>> violations = validator.validate(dto);
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("maxStayNights")));
    }

    @Test
    void validation_maxUsesTotalZero_hasViolation() {
        BookingVoucherUpdateRequestDto dto = new BookingVoucherUpdateRequestDto(
                null, null, null, null, null, null, null,
                null, null, null, 0, null, null, null, null
        );
        Set<ConstraintViolation<BookingVoucherUpdateRequestDto>> violations = validator.validate(dto);
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("maxUsesTotal")));
    }

    @Test
    void validation_maxUsesPerGuestZero_hasViolation() {
        BookingVoucherUpdateRequestDto dto = new BookingVoucherUpdateRequestDto(
                null, null, null, null, null, null, null,
                null, null, null, null, 0, null, null, null
        );
        Set<ConstraintViolation<BookingVoucherUpdateRequestDto>> violations = validator.validate(dto);
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("maxUsesPerGuest")));
    }
}
