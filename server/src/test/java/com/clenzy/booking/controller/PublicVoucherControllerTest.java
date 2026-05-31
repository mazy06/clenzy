package com.clenzy.booking.controller;

import com.clenzy.dto.voucher.VoucherValidationRequestDto;
import com.clenzy.dto.voucher.VoucherValidationResponseDto;
import com.clenzy.model.BookingVoucher;
import com.clenzy.model.Property;
import com.clenzy.model.voucher.VoucherChannelScope;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.voucher.VoucherApplyResult;
import com.clenzy.service.voucher.VoucherEngine;
import com.clenzy.service.voucher.VoucherValidationError;
import com.clenzy.service.voucher.VoucherValidationResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link PublicVoucherController}.
 *
 * <h2>Focus</h2>
 * <ul>
 *   <li>Property introuvable -> NOT_FOUND (anti-enumeration cross-tenant)</li>
 *   <li>Property hors org -> NOT_FOUND (pas UNAUTHORIZED — meme reponse pour ne pas leak)</li>
 *   <li>VoucherEngine.validate retourne Invalid -> map vers error code+message</li>
 *   <li>VoucherEngine.validate retourne Valid -> apply, retourne discount+finalTotal</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class PublicVoucherControllerTest {

    @Mock
    private VoucherEngine voucherEngine;

    @Mock
    private PropertyRepository propertyRepository;

    private PublicVoucherController controller;

    @BeforeEach
    void setUp() {
        controller = new PublicVoucherController(voucherEngine, propertyRepository);
    }

    private VoucherValidationRequestDto request(Long orgId, Long propertyId, String code) {
        return new VoucherValidationRequestDto(
                orgId, code, propertyId, 3,
                BigDecimal.valueOf(450), "guest@example.com",
                VoucherChannelScope.BOOKING_ENGINE);
    }

    private Property property(Long id, Long orgId) {
        Property p = new Property();
        p.setId(id);
        p.setOrganizationId(orgId);
        return p;
    }

    private BookingVoucher voucher(Long id, String code) {
        BookingVoucher v = new BookingVoucher();
        v.setCode(code);
        return v;
    }

    // ─── Property absent ─────────────────────────────────────────────────

    @Test
    @DisplayName("validate returns NOT_FOUND when property does not exist (anti-enumeration)")
    void validate_propertyNotFound_returnsNotFound() {
        when(propertyRepository.findById(999L)).thenReturn(Optional.empty());

        VoucherValidationResponseDto response = controller.validate(
                request(7L, 999L, "SUMMER25"));

        assertThat(response.valid()).isFalse();
        assertThat(response.errorCode()).isEqualTo(VoucherValidationError.NOT_FOUND);
        assertThat(response.errorMessage()).contains("inconnu");

        verify(voucherEngine, never()).validate(any(), anyString(), any(), anyInt(), any(), any(), any());
    }

    // ─── Property cross-tenant ───────────────────────────────────────────

    @Test
    @DisplayName("validate returns NOT_FOUND when property belongs to different org (cross-tenant)")
    void validate_propertyOrgMismatch_returnsNotFound() {
        // Property belongs to org 99, request says org 7 → mismatch
        when(propertyRepository.findById(101L)).thenReturn(Optional.of(property(101L, 99L)));

        VoucherValidationResponseDto response = controller.validate(
                request(7L, 101L, "WINTER10"));

        assertThat(response.valid()).isFalse();
        assertThat(response.errorCode()).isEqualTo(VoucherValidationError.NOT_FOUND);
        // Must NOT call voucherEngine — leaks would expose existence
        verify(voucherEngine, never()).validate(any(), anyString(), any(), anyInt(), any(), any(), any());
    }

    // ─── VoucherEngine returns Invalid ───────────────────────────────────

    @Test
    @DisplayName("validate propagates Invalid result from VoucherEngine (EXPIRED)")
    void validate_voucherEngineReturnsInvalidExpired() {
        when(propertyRepository.findById(101L)).thenReturn(Optional.of(property(101L, 7L)));
        when(voucherEngine.validate(eq(7L), eq("EXPIRED2024"), eq(101L), eq(3),
                any(), eq("guest@example.com"), eq(VoucherChannelScope.BOOKING_ENGINE)))
                .thenReturn(new VoucherValidationResult.Invalid(
                        VoucherValidationError.EXPIRED, "Code expire"));

        VoucherValidationResponseDto response = controller.validate(
                request(7L, 101L, "EXPIRED2024"));

        assertThat(response.valid()).isFalse();
        assertThat(response.errorCode()).isEqualTo(VoucherValidationError.EXPIRED);
        assertThat(response.errorMessage()).isEqualTo("Code expire");
        verify(voucherEngine, never()).apply(any(), any(), anyInt());
    }

    @Test
    @DisplayName("validate propagates Invalid result (PAUSED)")
    void validate_voucherEngineReturnsInvalidPaused() {
        when(propertyRepository.findById(50L)).thenReturn(Optional.of(property(50L, 1L)));
        when(voucherEngine.validate(eq(1L), eq("PAUSED10"), eq(50L), anyInt(),
                any(), anyString(), any()))
                .thenReturn(new VoucherValidationResult.Invalid(
                        VoucherValidationError.PAUSED, "Voucher en pause"));

        VoucherValidationResponseDto response = controller.validate(
                request(1L, 50L, "PAUSED10"));

        assertThat(response.valid()).isFalse();
        assertThat(response.errorCode()).isEqualTo(VoucherValidationError.PAUSED);
    }

    // ─── VoucherEngine returns Valid ─────────────────────────────────────

    @Test
    @DisplayName("validate returns Valid response with discount + finalTotal when voucher applies")
    void validate_validVoucher_returnsDiscountAndFinalTotal() {
        when(propertyRepository.findById(101L)).thenReturn(Optional.of(property(101L, 7L)));

        BookingVoucher v = voucher(11L, "SUMMER25");
        when(voucherEngine.validate(eq(7L), eq("SUMMER25"), eq(101L), anyInt(),
                any(), anyString(), any()))
                .thenReturn(new VoucherValidationResult.Valid(v));

        when(voucherEngine.apply(eq(v), eq(BigDecimal.valueOf(450)), eq(3)))
                .thenReturn(new VoucherApplyResult(
                        11L, "SUMMER25",
                        BigDecimal.valueOf(450),
                        BigDecimal.valueOf(112.50),
                        BigDecimal.valueOf(337.50)));

        VoucherValidationResponseDto response = controller.validate(
                request(7L, 101L, "SUMMER25"));

        assertThat(response.valid()).isTrue();
        assertThat(response.code()).isEqualTo("SUMMER25");
        assertThat(response.discountAmount()).isEqualByComparingTo("112.50");
        assertThat(response.finalTotal()).isEqualByComparingTo("337.50");
        assertThat(response.errorCode()).isNull();
        assertThat(response.errorMessage()).isNull();
    }

    @Test
    @DisplayName("validate passes channel scope through to engine")
    void validate_propagatesChannelScope() {
        when(propertyRepository.findById(1L)).thenReturn(Optional.of(property(1L, 1L)));
        when(voucherEngine.validate(any(), anyString(), any(), anyInt(),
                any(), any(), eq(VoucherChannelScope.WHATSAPP)))
                .thenReturn(new VoucherValidationResult.Invalid(
                        VoucherValidationError.NOT_FOUND, "x"));

        VoucherValidationRequestDto req = new VoucherValidationRequestDto(
                1L, "CODE", 1L, 2, BigDecimal.TEN, null,
                VoucherChannelScope.WHATSAPP);
        VoucherValidationResponseDto resp = controller.validate(req);

        assertThat(resp.valid()).isFalse();
        verify(voucherEngine).validate(eq(1L), eq("CODE"), eq(1L), eq(2),
                eq(BigDecimal.TEN), eq(null), eq(VoucherChannelScope.WHATSAPP));
    }
}
