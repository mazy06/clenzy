package com.clenzy.booking.controller;

import com.clenzy.booking.dto.AvailabilityRequestDto;
import com.clenzy.booking.dto.AvailabilityResponseDto;
import com.clenzy.booking.dto.BookingCheckoutRequestDto;
import com.clenzy.booking.dto.BookingCheckoutResponseDto;
import com.clenzy.booking.dto.BookingConfirmationDto;
import com.clenzy.booking.dto.BookingEngineConfigDto;
import com.clenzy.booking.dto.BookingReserveBatchRequestDto;
import com.clenzy.booking.dto.BookingReserveBatchResponseDto;
import com.clenzy.booking.dto.BookingReserveRequestDto;
import com.clenzy.booking.dto.BookingReserveResponseDto;
import com.clenzy.booking.dto.BookingServiceCategoryDto;
import com.clenzy.booking.dto.PublicPropertyDetailDto;
import com.clenzy.booking.dto.PublicPropertyDto;
import com.clenzy.booking.dto.PublicReviewDto;
import com.clenzy.booking.dto.ReviewStatsDto;
import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.service.BookingServiceOptionsService;
import com.clenzy.booking.service.PublicBookingService;
import com.clenzy.booking.service.PublicBookingService.OrgContext;
import com.clenzy.model.Organization;
import com.clenzy.service.PropertyPhotoService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PublicBookingControllerTest {

    @Mock private PublicBookingService bookingService;
    @Mock private BookingServiceOptionsService serviceOptionsService;
    @Mock private PropertyPhotoService photoService;
    @Mock private com.clenzy.booking.security.BookingPublicRateLimiter rateLimiter;
    @Mock private HttpServletRequest request;

    private PublicBookingController controller;
    private OrgContext ctx;

    @BeforeEach
    void setUp() {
        // Vrai service de conversion (converter mocké) : passthrough quand currency == null.
        var displayCurrencyService = new com.clenzy.booking.service.BookingDisplayCurrencyService(
            org.mockito.Mockito.mock(com.clenzy.service.CurrencyConverterService.class));
        controller = new PublicBookingController(bookingService, serviceOptionsService, photoService, rateLimiter,
            displayCurrencyService,
            org.mockito.Mockito.mock(com.clenzy.booking.service.PublicBookingCalendarService.class),
            org.mockito.Mockito.mock(com.clenzy.service.LeadCaptureService.class),
            org.mockito.Mockito.mock(com.clenzy.booking.service.PublicCancellationService.class),
            org.mockito.Mockito.mock(com.clenzy.booking.service.PublicReviewService.class),
            org.mockito.Mockito.mock(com.clenzy.booking.service.BookingBalanceService.class),
            org.mockito.Mockito.mock(com.clenzy.booking.service.BookingGuestAuthService.class),
            org.mockito.Mockito.mock(com.clenzy.booking.service.PublicConciergeService.class),
            org.mockito.Mockito.mock(com.clenzy.booking.service.BookingInquiryService.class));
        lenient().when(rateLimiter.tryAcquireHold(any(), anyLong())).thenReturn(true);
        lenient().when(rateLimiter.tryAcquireBatch(any())).thenReturn(true);

        Organization org = mock(Organization.class);
        lenient().when(org.getId()).thenReturn(1L);
        BookingEngineConfig cfg = new BookingEngineConfig();
        ctx = new OrgContext(org, cfg);
    }

    @Test
    void getConfig_resolvedViaFilter() {
        BookingEngineConfig filterConfig = new BookingEngineConfig();
        when(request.getAttribute("bookingConfig")).thenReturn(filterConfig);
        when(bookingService.resolveFromFilter(filterConfig)).thenReturn(ctx);

        BookingEngineConfigDto dto = new BookingEngineConfigDto("#fff", "#000", null, null, "fr",
                "EUR", 0, 365, "Flex", null, null, true, true, true, null, null, null, null, null, null, null, null, null, null, true, false, null);
        when(bookingService.getConfig(ctx)).thenReturn(dto);

        ResponseEntity<BookingEngineConfigDto> response = controller.getConfig("slug", request);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void getConfig_fallbackToResolveOrg() {
        when(request.getAttribute("bookingConfig")).thenReturn(null);
        when(bookingService.resolveOrg("slug")).thenReturn(ctx);

        BookingEngineConfigDto dto = new BookingEngineConfigDto("#fff", "#000", null, null, "fr",
                "EUR", 0, 365, "Flex", null, null, true, true, true, null, null, null, null, null, null, null, null, null, null, true, false, null);
        when(bookingService.getConfig(ctx)).thenReturn(dto);

        ResponseEntity<BookingEngineConfigDto> response = controller.getConfig("slug", request);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void getProperties_returnsList() {
        when(request.getAttribute("bookingConfig")).thenReturn(ctx.config());
        when(bookingService.resolveFromFilter(any())).thenReturn(ctx);
        when(bookingService.getProperties(eq(ctx), any(), any())).thenReturn(List.of(
                mock(PublicPropertyDto.class), mock(PublicPropertyDto.class)));

        ResponseEntity<List<PublicPropertyDto>> response = controller.getProperties(
                "slug", null, null, null, null, null, null, null, null, request);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).hasSize(2);
    }

    @Test
    void getProperty_detail() {
        when(request.getAttribute("bookingConfig")).thenReturn(ctx.config());
        when(bookingService.resolveFromFilter(any())).thenReturn(ctx);
        PublicPropertyDetailDto detail = mock(PublicPropertyDetailDto.class);
        when(bookingService.getPropertyDetail(ctx, 10L)).thenReturn(detail);

        ResponseEntity<PublicPropertyDetailDto> response = controller.getProperty("slug", 10L, null, request);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void checkAvailability_returnsResponse() {
        when(request.getAttribute("bookingConfig")).thenReturn(ctx.config());
        when(bookingService.resolveFromFilter(any())).thenReturn(ctx);

        AvailabilityRequestDto req = new AvailabilityRequestDto(10L, LocalDate.now().plusDays(1),
                LocalDate.now().plusDays(3), 2);
        AvailabilityResponseDto resp = AvailabilityResponseDto.unavailable(10L,
                req.checkIn(), req.checkOut(), 2, List.of());
        when(bookingService.checkAvailability(eq(ctx), eq(req), anyBoolean())).thenReturn(resp);

        ResponseEntity<AvailabilityResponseDto> response = controller.checkAvailability("slug", null, req, request);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void reserve_returnsResponse() {
        when(request.getAttribute("bookingConfig")).thenReturn(ctx.config());
        when(bookingService.resolveFromFilter(any())).thenReturn(ctx);

        BookingReserveRequestDto.GuestInfo gi = new BookingReserveRequestDto.GuestInfo("John", "j@t.com", "0600");
        BookingReserveRequestDto req = new BookingReserveRequestDto(10L, LocalDate.now().plusDays(1),
                LocalDate.now().plusDays(3), 2, gi, null, null);
        BookingReserveResponseDto resp = BookingReserveResponseDto.withoutVoucher(
                "code-1", "PENDING", "Prop", req.checkIn(), req.checkOut(),
                BigDecimal.valueOf(100), "EUR", null, true);
        when(bookingService.reserve(eq(ctx), eq(req), anyBoolean())).thenReturn(resp);

        ResponseEntity<?> response = controller.reserve("slug", req, request);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void reserve_rateLimited_returns429() {
        BookingReserveRequestDto.GuestInfo gi = new BookingReserveRequestDto.GuestInfo("John", "j@t.com", "0600");
        BookingReserveRequestDto req = new BookingReserveRequestDto(10L, LocalDate.now().plusDays(1),
                LocalDate.now().plusDays(3), 2, gi, null, null);
        when(rateLimiter.tryAcquireHold(any(), anyLong())).thenReturn(false);

        ResponseEntity<?> response = controller.reserve("slug", req, request);

        assertThat(response.getStatusCode().value()).isEqualTo(429);
        org.mockito.Mockito.verifyNoInteractions(bookingService);
    }

    @Test
    void reserveBatch_returnsResponse() {
        when(request.getAttribute("bookingConfig")).thenReturn(ctx.config());
        when(bookingService.resolveFromFilter(any())).thenReturn(ctx);

        BookingReserveRequestDto.GuestInfo gi = new BookingReserveRequestDto.GuestInfo("J", "j@x.com", null);
        BookingReserveBatchRequestDto.Item item = new BookingReserveBatchRequestDto.Item(
                10L, LocalDate.now().plusDays(1), LocalDate.now().plusDays(3), 2, null);
        BookingReserveBatchRequestDto req = new BookingReserveBatchRequestDto(List.of(item), gi);
        BookingReserveBatchResponseDto resp = new BookingReserveBatchResponseDto(
                "batch", List.of(), BigDecimal.TEN, "EUR", null, true);
        when(bookingService.reserveBatch(eq(ctx), eq(req), anyBoolean())).thenReturn(resp);

        ResponseEntity<?> response = controller.reserveBatch("slug", req, request);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void reserveBatch_rateLimited_returns429() {
        BookingReserveRequestDto.GuestInfo gi = new BookingReserveRequestDto.GuestInfo("J", "j@x.com", null);
        BookingReserveBatchRequestDto.Item item = new BookingReserveBatchRequestDto.Item(
                10L, LocalDate.now().plusDays(1), LocalDate.now().plusDays(3), 2, null);
        BookingReserveBatchRequestDto req = new BookingReserveBatchRequestDto(List.of(item), gi);
        when(rateLimiter.tryAcquireBatch(any())).thenReturn(false);

        ResponseEntity<?> response = controller.reserveBatch("slug", req, request);

        assertThat(response.getStatusCode().value()).isEqualTo(429);
        org.mockito.Mockito.verifyNoInteractions(bookingService);
    }

    @Test
    void checkout_returnsResponse() {
        when(request.getAttribute("bookingConfig")).thenReturn(ctx.config());
        when(bookingService.resolveFromFilter(any())).thenReturn(ctx);

        BookingCheckoutRequestDto req = new BookingCheckoutRequestDto("code-1", null);
        BookingCheckoutResponseDto resp = new BookingCheckoutResponseDto("https://stripe.test", "s_1");
        when(bookingService.checkout(eq(ctx), eq(req), any())).thenReturn(resp);

        ResponseEntity<BookingCheckoutResponseDto> response = controller.checkout("slug", req, request);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void getConfirmation_returnsConfirmation() {
        when(request.getAttribute("bookingConfig")).thenReturn(ctx.config());
        when(bookingService.resolveFromFilter(any())).thenReturn(ctx);
        BookingConfirmationDto dto = mock(BookingConfirmationDto.class);
        when(bookingService.getConfirmation(ctx, "code-1")).thenReturn(dto);

        ResponseEntity<BookingConfirmationDto> response = controller.getConfirmation("slug", "code-1", request);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void getPublicPhotoData_success() {
        when(request.getAttribute("bookingConfig")).thenReturn(ctx.config());
        when(bookingService.resolveFromFilter(any())).thenReturn(ctx);
        when(photoService.getPhotoData(10L, 100L)).thenReturn(new byte[]{1, 2, 3});
        when(photoService.getPhotoContentType(10L, 100L)).thenReturn("image/jpeg");

        ResponseEntity<byte[]> response = controller.getPublicPhotoData("slug", 10L, 100L, request);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).hasSize(3);
    }

    @Test
    void getPublicPhotoData_failure_returns404() {
        when(request.getAttribute("bookingConfig")).thenReturn(ctx.config());
        when(bookingService.resolveFromFilter(any())).thenReturn(ctx);
        when(photoService.getPhotoData(10L, 100L)).thenThrow(new RuntimeException("not found"));

        ResponseEntity<byte[]> response = controller.getPublicPhotoData("slug", 10L, 100L, request);
        assertThat(response.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void getReviews_returnsPage() {
        when(request.getAttribute("bookingConfig")).thenReturn(ctx.config());
        when(bookingService.resolveFromFilter(any())).thenReturn(ctx);
        Page<PublicReviewDto> page = new PageImpl<>(List.of());
        when(bookingService.getPublicReviews(any(), any(), any())).thenReturn(page);

        ResponseEntity<Page<PublicReviewDto>> response = controller.getReviews("slug", null, 0, 5, request);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void getReviews_largeSizeCapped() {
        when(request.getAttribute("bookingConfig")).thenReturn(ctx.config());
        when(bookingService.resolveFromFilter(any())).thenReturn(ctx);
        Page<PublicReviewDto> page = new PageImpl<>(List.of());
        when(bookingService.getPublicReviews(any(), any(), any())).thenReturn(page);

        ResponseEntity<Page<PublicReviewDto>> response = controller.getReviews("slug", 10L, 0, 50, request);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void getReviewStats_returnsStats() {
        when(request.getAttribute("bookingConfig")).thenReturn(ctx.config());
        when(bookingService.resolveFromFilter(any())).thenReturn(ctx);
        ReviewStatsDto stats = mock(ReviewStatsDto.class);
        when(bookingService.getReviewStats(ctx, 10L)).thenReturn(stats);

        ResponseEntity<ReviewStatsDto> response = controller.getReviewStats("slug", 10L, request);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void getServiceOptions_returnsCategories() {
        when(request.getAttribute("bookingConfig")).thenReturn(ctx.config());
        when(bookingService.resolveFromFilter(any())).thenReturn(ctx);
        when(serviceOptionsService.listActiveCategories(1L)).thenReturn(List.of(mock(BookingServiceCategoryDto.class)));

        ResponseEntity<List<BookingServiceCategoryDto>> response = controller.getServiceOptions("slug", request);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).hasSize(1);
    }

    @Test
    void handleIllegalArgument_returnsBadRequest() {
        ResponseEntity<Map<String, String>> response = controller.handleIllegalArgument(
                new IllegalArgumentException("invalid date"));
        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody()).containsEntry("error", "invalid date");
    }

    @Test
    void handleIllegalState_returnsConflict() {
        ResponseEntity<Map<String, String>> response = controller.handleIllegalState(
                new IllegalStateException("not available"));
        assertThat(response.getStatusCode().value()).isEqualTo(409);
    }

    @Test
    void handleRuntimeException_returns500() {
        ResponseEntity<Map<String, String>> response = controller.handleRuntimeException(
                new RuntimeException("boom"));
        assertThat(response.getStatusCode().value()).isEqualTo(500);
        assertThat(response.getBody()).containsEntry("error", "Erreur interne du serveur");
    }
}
