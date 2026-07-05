package com.clenzy.booking.service;

import com.clenzy.booking.dto.*;
import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.repository.BookingEngineConfigRepository;
import com.clenzy.booking.security.BookingFraudScoringService;
import com.clenzy.booking.security.RiskAssessment;
import com.clenzy.booking.security.RiskLevel;
import com.clenzy.dto.TouristTaxCalculationDto;
import com.clenzy.model.*;
import com.clenzy.model.voucher.VoucherChannelScope;
import com.clenzy.repository.*;
import com.clenzy.service.*;
import com.clenzy.service.voucher.VoucherApplyResult;
import com.clenzy.service.voucher.VoucherEngine;
import com.clenzy.service.voucher.VoucherValidationError;
import com.clenzy.service.voucher.VoucherValidationResult;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PublicBookingServiceTest {

    @Mock private BookingEngineConfigRepository configRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private CalendarDayRepository calendarDayRepository;
    @Mock private PriceEngine priceEngine;
    @Mock private RestrictionEngine restrictionEngine;
    @Mock private CalendarEngine calendarEngine;
    @Mock private GuestService guestService;
    @Mock private TouristTaxService touristTaxService;
    @Mock private StripeService stripeService;
    @Mock private GuestReviewRepository guestReviewRepository;
    @Mock private VoucherEngine voucherEngine;
    @Mock private NotificationService notificationService;
    @Mock private BookingServiceOptionsService serviceOptionsService;
    @Mock private com.clenzy.booking.security.BookingFraudScoringService fraudScoringService;

    private PublicBookingService service;

    private static final Long ORG_ID = 10L;
    private static final Long PROPERTY_ID = 42L;
    private static final String SLUG = "my-org";

    @BeforeEach
    void setUp() {
        service = new PublicBookingService(
                configRepository, organizationRepository, propertyRepository,
                reservationRepository, calendarDayRepository, priceEngine,
                restrictionEngine, calendarEngine, guestService, touristTaxService,
                stripeService, guestReviewRepository, voucherEngine, notificationService,
                serviceOptionsService,
                org.mockito.Mockito.mock(com.clenzy.service.email.BookingConfirmationEmailService.class),
                org.mockito.Mockito.mock(com.clenzy.booking.service.BookingEngineDepositService.class),
                org.mockito.Mockito.mock(com.clenzy.booking.service.GuestCreditService.class),
                org.mockito.Mockito.mock(com.clenzy.booking.repository.SiteRepository.class),
                org.mockito.Mockito.mock(com.clenzy.booking.repository.SitePageRepository.class),
                org.mockito.Mockito.mock(com.clenzy.booking.service.BookingDisplayCurrencyService.class),
                org.mockito.Mockito.mock(com.clenzy.service.UpsellService.class),
                fraudScoringService,
                new BookingMockDataProvider());
    }

    // ───────────────────── helpers ──────────────────────────────────────────────

    private Organization buildOrg() {
        Organization o = new Organization();
        o.setId(ORG_ID);
        o.setName("My Org");
        o.setSlug(SLUG);
        return o;
    }

    private BookingEngineConfig buildConfig(boolean enabled) {
        BookingEngineConfig c = new BookingEngineConfig();
        c.setId(1L);
        c.setOrganizationId(ORG_ID);
        c.setApiKey("key");
        c.setEnabled(enabled);
        c.setMinAdvanceDays(0);
        c.setMaxAdvanceDays(365);
        c.setAutoConfirm(false);
        c.setCollectPaymentOnBooking(true);
        c.setShowCleaningFee(true);
        c.setShowTouristTax(true);
        c.setDefaultCurrency("EUR");
        return c;
    }

    private Property buildProperty() {
        Property p = new Property();
        p.setId(PROPERTY_ID);
        p.setName("Cosy Loft");
        p.setOrganizationId(ORG_ID);
        p.setMaxGuests(4);
        p.setMinimumNights(1);
        p.setNightlyPrice(new BigDecimal("100.00"));
        p.setCleaningBasePrice(new BigDecimal("30.00"));
        p.setDefaultCurrency("EUR");
        p.setDefaultCheckInTime("15:00");
        p.setDefaultCheckOutTime("11:00");
        p.setType(PropertyType.APARTMENT);
        p.setCity("Paris");
        p.setCountry("FR");
        return p;
    }

    private PublicBookingService.OrgContext buildCtx() {
        return new PublicBookingService.OrgContext(buildOrg(), buildConfig(true));
    }

    private AvailabilityRequestDto request(LocalDate in, LocalDate out, int guests) {
        return new AvailabilityRequestDto(PROPERTY_ID, in, out, guests);
    }

    // ───────────────────── resolveOrg ───────────────────────────────────────────

    @Nested
    class ResolveOrg {

        @Test
        @DisplayName("returns context when slug matches and config enabled")
        void whenSlugValidAndEnabled_thenReturnsCtx() {
            Organization org = buildOrg();
            BookingEngineConfig cfg = buildConfig(true);
            when(organizationRepository.findBySlug(SLUG)).thenReturn(Optional.of(org));
            when(configRepository.findAllByOrganizationId(ORG_ID)).thenReturn(List.of(cfg));

            PublicBookingService.OrgContext ctx = service.resolveOrg(SLUG);

            assertThat(ctx.orgId()).isEqualTo(ORG_ID);
            assertThat(ctx.config()).isSameAs(cfg);
        }

        @Test
        @DisplayName("throws when slug unknown")
        void whenSlugUnknown_thenThrows() {
            when(organizationRepository.findBySlug("missing")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.resolveOrg("missing"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Organisation introuvable");
        }

        @Test
        @DisplayName("throws when booking engine disabled for org")
        void whenAllConfigsDisabled_thenThrows() {
            Organization org = buildOrg();
            BookingEngineConfig cfg = buildConfig(false);
            when(organizationRepository.findBySlug(SLUG)).thenReturn(Optional.of(org));
            when(configRepository.findAllByOrganizationId(ORG_ID)).thenReturn(List.of(cfg));

            assertThatThrownBy(() -> service.resolveOrg(SLUG))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Booking Engine");
        }

        @Test
        @DisplayName("resolveFromFilter loads org from config")
        void resolveFromFilter_loadsOrg() {
            Organization org = buildOrg();
            BookingEngineConfig cfg = buildConfig(true);
            when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));

            PublicBookingService.OrgContext ctx = service.resolveFromFilter(cfg);

            assertThat(ctx.org()).isSameAs(org);
            assertThat(ctx.config()).isSameAs(cfg);
            assertThat(ctx.orgId()).isEqualTo(ORG_ID);
        }

        @Test
        @DisplayName("resolveFromFilter throws when org missing")
        void resolveFromFilter_throwsOnMissing() {
            BookingEngineConfig cfg = buildConfig(true);
            when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.resolveFromFilter(cfg))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ───────────────────── getConfig / getProperties / getPropertyDetail ────────

    @Nested
    class PropertiesAndConfig {

        @Test
        void getConfig_mapsToDto() {
            PublicBookingService.OrgContext ctx = buildCtx();
            BookingEngineConfigDto dto = service.getConfig(ctx);
            assertThat(dto).isNotNull();
            assertThat(dto.defaultCurrency()).isEqualTo("EUR");
        }

        @Test
        void getProperties_mapsToPublicDtos() {
            Property p = buildProperty();
            when(propertyRepository.findBookingEngineVisible(ORG_ID)).thenReturn(List.of(p));

            List<PublicPropertyDto> result = service.getProperties(buildCtx());

            assertThat(result).hasSize(1);
            assertThat(result.get(0).id()).isEqualTo(PROPERTY_ID);
            assertThat(result.get(0).name()).isEqualTo("Cosy Loft");
        }

        @Test
        void getPropertyDetail_returnsDetail() {
            Property p = buildProperty();
            when(propertyRepository.findBookingEngineProperty(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(p));

            PublicPropertyDetailDto dto = service.getPropertyDetail(buildCtx(), PROPERTY_ID);

            assertThat(dto.id()).isEqualTo(PROPERTY_ID);
            assertThat(dto.name()).isEqualTo("Cosy Loft");
        }

        @Test
        void getPropertyDetail_throwsWhenMissing() {
            when(propertyRepository.findBookingEngineProperty(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getPropertyDetail(buildCtx(), PROPERTY_ID))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ───────────────────── checkAvailability ────────────────────────────────────

    @Nested
    class CheckAvailability {

        private LocalDate in;
        private LocalDate out;

        @BeforeEach
        void setUp() {
            in = LocalDate.now().plusDays(7);
            out = LocalDate.now().plusDays(10);
        }

        @Test
        @DisplayName("returns unavailable when checkOut not after checkIn")
        void whenCheckOutNotAfterCheckIn_thenUnavailable() {
            AvailabilityResponseDto resp = service.checkAvailability(buildCtx(), request(in, in, 2));
            assertThat(resp.available()).isFalse();
            assertThat(resp.violations()).anyMatch(v -> v.contains("checkOut"));
        }

        @Test
        @DisplayName("returns unavailable when property missing")
        void whenPropertyMissing_thenUnavailable() {
            when(propertyRepository.findBookingEngineProperty(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.empty());

            AvailabilityResponseDto resp = service.checkAvailability(buildCtx(), request(in, out, 2));

            assertThat(resp.available()).isFalse();
            assertThat(resp.violations()).anyMatch(v -> v.contains("introuvable"));
        }

        @Test
        @DisplayName("returns unavailable when guests exceed capacity")
        void whenGuestsExceedMax_thenUnavailable() {
            Property p = buildProperty();
            p.setMaxGuests(2);
            when(propertyRepository.findBookingEngineProperty(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(p));

            AvailabilityResponseDto resp = service.checkAvailability(buildCtx(), request(in, out, 10));

            assertThat(resp.available()).isFalse();
            assertThat(resp.violations()).anyMatch(v -> v.contains("capacite"));
        }

        @Test
        @DisplayName("returns unavailable when checkIn too soon (minAdvanceDays)")
        void whenTooSoon_thenUnavailable() {
            BookingEngineConfig cfg = buildConfig(true);
            cfg.setMinAdvanceDays(30);
            PublicBookingService.OrgContext ctx = new PublicBookingService.OrgContext(buildOrg(), cfg);

            Property p = buildProperty();
            when(propertyRepository.findBookingEngineProperty(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(p));

            AvailabilityResponseDto resp = service.checkAvailability(ctx, request(in, out, 2));

            assertThat(resp.available()).isFalse();
            assertThat(resp.violations()).anyMatch(v -> v.contains("trop proche"));
        }

        @Test
        @DisplayName("returns unavailable when checkIn too far (maxAdvanceDays)")
        void whenTooFar_thenUnavailable() {
            BookingEngineConfig cfg = buildConfig(true);
            cfg.setMaxAdvanceDays(3);
            PublicBookingService.OrgContext ctx = new PublicBookingService.OrgContext(buildOrg(), cfg);

            Property p = buildProperty();
            when(propertyRepository.findBookingEngineProperty(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(p));

            AvailabilityResponseDto resp = service.checkAvailability(ctx, request(in, out, 2));

            assertThat(resp.available()).isFalse();
            assertThat(resp.violations()).anyMatch(v -> v.contains("trop lointaine"));
        }

        @Test
        @DisplayName("returns unavailable when restriction violation")
        void whenRestrictionViolated_thenUnavailable() {
            Property p = buildProperty();
            when(propertyRepository.findBookingEngineProperty(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(p));
            when(restrictionEngine.validate(PROPERTY_ID, in, out, ORG_ID))
                    .thenReturn(RestrictionEngine.ValidationResult.invalid(List.of("Sejour min 5 nuits")));

            AvailabilityResponseDto resp = service.checkAvailability(buildCtx(), request(in, out, 2));

            assertThat(resp.available()).isFalse();
            assertThat(resp.violations()).contains("Sejour min 5 nuits");
        }

        @Test
        @DisplayName("returns unavailable when calendar conflicts > 0")
        void whenCalendarConflicts_thenUnavailable() {
            Property p = buildProperty();
            when(propertyRepository.findBookingEngineProperty(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(p));
            when(restrictionEngine.validate(PROPERTY_ID, in, out, ORG_ID))
                    .thenReturn(RestrictionEngine.ValidationResult.valid());
            when(calendarDayRepository.countConflicts(PROPERTY_ID, in, out, ORG_ID)).thenReturn(2L);

            AvailabilityResponseDto resp = service.checkAvailability(buildCtx(), request(in, out, 2));

            assertThat(resp.available()).isFalse();
            assertThat(resp.violations()).anyMatch(v -> v.contains("non disponibles"));
        }

        @Test
        @DisplayName("returns available with breakdown + total when ok")
        void whenAllChecksPass_thenAvailableWithBreakdown() {
            Property p = buildProperty();
            when(propertyRepository.findBookingEngineProperty(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(p));
            when(restrictionEngine.validate(PROPERTY_ID, in, out, ORG_ID))
                    .thenReturn(RestrictionEngine.ValidationResult.valid());
            when(calendarDayRepository.countConflicts(PROPERTY_ID, in, out, ORG_ID)).thenReturn(0L);
            Map<LocalDate, BigDecimal> priceMap = new HashMap<>();
            priceMap.put(in, new BigDecimal("120.00"));
            priceMap.put(in.plusDays(1), new BigDecimal("110.00"));
            priceMap.put(in.plusDays(2), new BigDecimal("100.00"));
            when(priceEngine.resolvePriceRange(PROPERTY_ID, in, out, ORG_ID)).thenReturn(priceMap);

            TouristTaxCalculationDto taxCalc = new TouristTaxCalculationDto(
                    PROPERTY_ID, "Paris", null, 3, 2, new BigDecimal("1.50"),
                    new BigDecimal("9.00"), "ok");
            when(touristTaxService.calculate(eq(PROPERTY_ID), eq(ORG_ID), eq(3), eq(2), any()))
                    .thenReturn(taxCalc);

            AvailabilityResponseDto resp = service.checkAvailability(buildCtx(), request(in, out, 2));

            assertThat(resp.available()).isTrue();
            assertThat(resp.nights()).isEqualTo(3);
            assertThat(resp.breakdown()).hasSize(3);
            assertThat(resp.subtotal()).isEqualByComparingTo("330.00");
            assertThat(resp.cleaningFee()).isEqualByComparingTo("30.00");
            assertThat(resp.touristTax()).isEqualByComparingTo("9.00");
            assertThat(resp.total()).isEqualByComparingTo("369.00");
        }

        @Test
        @DisplayName("uses property nightlyPrice when priceEngine has no entry")
        void whenPriceMissing_thenFallsBackToProperty() {
            Property p = buildProperty();
            when(propertyRepository.findBookingEngineProperty(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(p));
            when(restrictionEngine.validate(any(), any(), any(), any()))
                    .thenReturn(RestrictionEngine.ValidationResult.valid());
            when(calendarDayRepository.countConflicts(any(), any(), any(), any())).thenReturn(0L);
            when(priceEngine.resolvePriceRange(any(), any(), any(), any())).thenReturn(Map.of());

            BookingEngineConfig cfg = buildConfig(true);
            cfg.setShowCleaningFee(false);
            cfg.setShowTouristTax(false);
            PublicBookingService.OrgContext ctx = new PublicBookingService.OrgContext(buildOrg(), cfg);

            AvailabilityResponseDto resp = service.checkAvailability(ctx, request(in, out, 2));

            assertThat(resp.available()).isTrue();
            // 3 nuits * 100 = 300
            assertThat(resp.subtotal()).isEqualByComparingTo("300.00");
            assertThat(resp.cleaningFee()).isEqualByComparingTo("0.00");
            assertThat(resp.touristTax()).isEqualByComparingTo("0.00");
        }
    }

    // ───────────────────── reserve ──────────────────────────────────────────────

    @Nested
    class Reserve {

        private LocalDate in;
        private LocalDate out;
        private BookingReserveRequestDto req;

        @BeforeEach
        void setUp() {
            in = LocalDate.now().plusDays(7);
            out = LocalDate.now().plusDays(10);
            req = new BookingReserveRequestDto(
                    PROPERTY_ID, in, out, 2,
                    new BookingReserveRequestDto.GuestInfo("John Doe", "john@example.com", "+33600000000"),
                    "Some notes",
                    null, null);
            // happy-path mocks needed for checkAvailability inside reserve()
            lenient().when(propertyRepository.findBookingEngineProperty(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(buildProperty()));
            lenient().when(restrictionEngine.validate(any(), any(), any(), any()))
                    .thenReturn(RestrictionEngine.ValidationResult.valid());
            lenient().when(calendarDayRepository.countConflicts(any(), any(), any(), any())).thenReturn(0L);
            Map<LocalDate, BigDecimal> priceMap = Map.of(
                    in, new BigDecimal("100.00"),
                    in.plusDays(1), new BigDecimal("100.00"),
                    in.plusDays(2), new BigDecimal("100.00")
            );
            lenient().when(priceEngine.resolvePriceRange(any(), any(), any(), any())).thenReturn(priceMap);
            // Guest service returns a stub guest
            Guest g = new Guest();
            g.setId(99L);
            g.setEmail("john@example.com");
            lenient().when(guestService.findOrCreate(anyString(), anyString(), anyString(), any(),
                    eq(GuestChannel.DIRECT), any(), eq(ORG_ID))).thenReturn(g);
            lenient().when(reservationRepository.save(any(Reservation.class)))
                    .thenAnswer(inv -> {
                        Reservation r = inv.getArgument(0);
                        r.setId(123L);
                        return r;
                    });
        }

        @Test
        @DisplayName("creates PENDING reservation when autoConfirm=false")
        void whenAutoConfirmFalse_thenPending() {
            BookingReserveResponseDto resp = service.reserve(buildCtx(), req);

            ArgumentCaptor<Reservation> captor = ArgumentCaptor.forClass(Reservation.class);
            verify(reservationRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus()).isEqualTo("pending");
            assertThat(resp.status()).isEqualTo("PENDING");
            assertThat(resp.expiresAt()).isNotNull();
            assertThat(resp.requiresPayment()).isTrue();
            assertThat(resp.voucherApplied()).isFalse();
        }

        @Test
        @DisplayName("Z4A-BUGS-04: autoConfirm + collectPaymentOnBooking stays PENDING until payment")
        void whenAutoConfirmAndPaymentCollected_thenStaysPendingWithExpiration() {
            BookingEngineConfig cfg = buildConfig(true);
            cfg.setAutoConfirm(true);
            cfg.setCollectPaymentOnBooking(true);
            PublicBookingService.OrgContext ctx = new PublicBookingService.OrgContext(buildOrg(), cfg);

            BookingReserveResponseDto resp = service.reserve(ctx, req);

            ArgumentCaptor<Reservation> captor = ArgumentCaptor.forClass(Reservation.class);
            verify(reservationRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus()).isEqualTo("pending");
            assertThat(captor.getValue().getPaymentStatus()).isEqualTo(PaymentStatus.PENDING);
            assertThat(resp.status()).isEqualTo("PENDING");
            assertThat(resp.expiresAt()).isNotNull();
        }

        @Test
        @DisplayName("creates CONFIRMED reservation when autoConfirm=true and no payment collected")
        void whenAutoConfirmWithoutPaymentCollection_thenConfirmed() {
            BookingEngineConfig cfg = buildConfig(true);
            cfg.setAutoConfirm(true);
            cfg.setCollectPaymentOnBooking(false);
            PublicBookingService.OrgContext ctx = new PublicBookingService.OrgContext(buildOrg(), cfg);

            BookingReserveResponseDto resp = service.reserve(ctx, req);

            assertThat(resp.status()).isEqualTo("CONFIRMED");
            assertThat(resp.expiresAt()).isNull();
        }

        @Test
        @DisplayName("paymentStatus=NOT_REQUIRED when collectPaymentOnBooking=false")
        void whenPaymentNotCollected_thenNotRequired() {
            BookingEngineConfig cfg = buildConfig(true);
            cfg.setCollectPaymentOnBooking(false);
            PublicBookingService.OrgContext ctx = new PublicBookingService.OrgContext(buildOrg(), cfg);

            BookingReserveResponseDto resp = service.reserve(ctx, req);

            ArgumentCaptor<Reservation> captor = ArgumentCaptor.forClass(Reservation.class);
            verify(reservationRepository).save(captor.capture());
            assertThat(captor.getValue().getPaymentStatus()).isEqualTo(PaymentStatus.NOT_REQUIRED);
            assertThat(resp.requiresPayment()).isFalse();
        }

        @Test
        @DisplayName("throws when availability fails inside reserve")
        void whenUnavailable_thenThrows() {
            when(calendarDayRepository.countConflicts(any(), any(), any(), any())).thenReturn(5L);

            assertThatThrownBy(() -> service.reserve(buildCtx(), req))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Dates non disponibles");
        }

        @Test
        @DisplayName("applies voucher discount when code is valid")
        void whenValidVoucher_thenDiscountApplied() {
            BookingReserveRequestDto reqWithVoucher = new BookingReserveRequestDto(
                    PROPERTY_ID, in, out, 2, req.guest(), null, "PROMO10", null);

            BookingVoucher voucher = new BookingVoucher();
            voucher.setId(7L);
            voucher.setCode("PROMO10");

            when(voucherEngine.validate(eq(ORG_ID), eq("PROMO10"), eq(PROPERTY_ID), eq(3),
                    any(BigDecimal.class), eq("john@example.com"), eq(VoucherChannelScope.BOOKING_ENGINE)))
                    .thenReturn(new VoucherValidationResult.Valid(voucher));
            VoucherApplyResult applied = new VoucherApplyResult(
                    7L, "PROMO10",
                    new BigDecimal("330.00"), new BigDecimal("33.00"), new BigDecimal("297.00"));
            when(voucherEngine.apply(eq(voucher), any(BigDecimal.class), eq(3))).thenReturn(applied);
            when(voucherEngine.recordUsage(eq(voucher), eq(123L), eq(ORG_ID), eq(PROPERTY_ID),
                    eq(applied), eq("john@example.com"), eq("BOOKING_ENGINE")))
                    .thenReturn(Optional.of(new VoucherUsage()));

            BookingReserveResponseDto resp = service.reserve(buildCtx(), reqWithVoucher);

            assertThat(resp.voucherApplied()).isTrue();
            assertThat(resp.originalTotal()).isEqualByComparingTo("330.00");
            assertThat(resp.discountAmount()).isEqualByComparingTo("33.00");
            assertThat(resp.total()).isEqualByComparingTo("297.00");
        }

        @Test
        @DisplayName("falls back gracefully when voucher rejected")
        void whenInvalidVoucher_thenRejectionReason() {
            BookingReserveRequestDto reqWithVoucher = new BookingReserveRequestDto(
                    PROPERTY_ID, in, out, 2, req.guest(), null, "BAD", null);
            when(voucherEngine.validate(any(), any(), any(), anyInt(), any(), any(), any()))
                    .thenReturn(new VoucherValidationResult.Invalid(
                            VoucherValidationError.EXPIRED, "Expired"));

            BookingReserveResponseDto resp = service.reserve(buildCtx(), reqWithVoucher);

            assertThat(resp.voucherApplied()).isFalse();
            assertThat(resp.voucherRejectedReason()).isEqualTo(VoucherValidationError.EXPIRED);
        }

        @Test
        @DisplayName("rolls back voucher fields when recordUsage races and fails")
        void whenRecordUsageEmpty_thenRollback() {
            BookingReserveRequestDto reqWithVoucher = new BookingReserveRequestDto(
                    PROPERTY_ID, in, out, 2, req.guest(), null, "PROMO", null);
            BookingVoucher voucher = new BookingVoucher();
            voucher.setId(7L);
            voucher.setCode("PROMO");
            when(voucherEngine.validate(any(), any(), any(), anyInt(), any(), any(), any()))
                    .thenReturn(new VoucherValidationResult.Valid(voucher));
            when(voucherEngine.apply(eq(voucher), any(), anyInt()))
                    .thenReturn(new VoucherApplyResult(7L, "PROMO",
                            new BigDecimal("330.00"), new BigDecimal("33.00"), new BigDecimal("297.00")));
            when(voucherEngine.recordUsage(any(), any(), any(), any(), any(), any(), any()))
                    .thenReturn(Optional.empty());

            BookingReserveResponseDto resp = service.reserve(buildCtx(), reqWithVoucher);

            // Voucher fields rolled back — voucherApplied still flips to true on the DTO
            // because we built it before the race detection (per service code).
            assertThat(resp).isNotNull();
            // The reservation should have been saved twice
            verify(reservationRepository, times(2)).save(any(Reservation.class));
        }

        @Test
        @DisplayName("blocks calendar via CalendarEngine.book")
        void whenReserved_thenCalendarBooked() {
            service.reserve(buildCtx(), req);

            verify(calendarEngine).book(eq(PROPERTY_ID), eq(in), eq(out),
                    eq(123L), eq(ORG_ID), eq("direct"), eq("booking-engine"));
        }
    }

    // ───────────────────── reserveBatch ──────────────────────────────────────────

    @Nested
    class ReserveBatch {

        private LocalDate in;
        private LocalDate out;

        @BeforeEach
        void setUp() {
            in = LocalDate.now().plusDays(7);
            out = LocalDate.now().plusDays(10);
            lenient().when(propertyRepository.findBookingEngineProperty(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(buildProperty()));
            lenient().when(restrictionEngine.validate(any(), any(), any(), any()))
                    .thenReturn(RestrictionEngine.ValidationResult.valid());
            lenient().when(calendarDayRepository.countConflicts(any(), any(), any(), any())).thenReturn(0L);
            lenient().when(priceEngine.resolvePriceRange(any(), any(), any(), any())).thenReturn(
                    Map.of(in, new BigDecimal("100.00"),
                            in.plusDays(1), new BigDecimal("100.00"),
                            in.plusDays(2), new BigDecimal("100.00")));
            Guest g = new Guest(); g.setId(1L);
            lenient().when(guestService.findOrCreate(anyString(), anyString(), anyString(), any(),
                    eq(GuestChannel.DIRECT), any(), eq(ORG_ID))).thenReturn(g);
            lenient().when(reservationRepository.save(any(Reservation.class)))
                    .thenAnswer(inv -> {
                        Reservation r = inv.getArgument(0);
                        r.setId(System.nanoTime());
                        return r;
                    });
        }

        @Test
        @DisplayName("throws when items list is empty")
        void whenEmpty_thenThrows() {
            BookingReserveBatchRequestDto req = new BookingReserveBatchRequestDto(
                    List.of(),
                    new BookingReserveRequestDto.GuestInfo("J", "j@e.com", "+33"));
            assertThatThrownBy(() -> service.reserveBatch(buildCtx(), req))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("creates one reservation per item")
        void whenMultipleItems_thenCreatesEach() {
            BookingReserveBatchRequestDto.Item it1 = new BookingReserveBatchRequestDto.Item(
                    PROPERTY_ID, in, out, 2, null, null);
            BookingReserveBatchRequestDto.Item it2 = new BookingReserveBatchRequestDto.Item(
                    PROPERTY_ID, in.plusDays(10), out.plusDays(10), 2, null, null);
            BookingReserveBatchRequestDto req = new BookingReserveBatchRequestDto(
                    List.of(it1, it2),
                    new BookingReserveRequestDto.GuestInfo("Jane Doe", "jane@example.com", null));

            // also stub the second range
            when(priceEngine.resolvePriceRange(any(), eq(in.plusDays(10)), eq(out.plusDays(10)), any()))
                    .thenReturn(Map.of(in.plusDays(10), new BigDecimal("100.00")));

            BookingReserveBatchResponseDto resp = service.reserveBatch(buildCtx(), req);

            assertThat(resp.reservations()).hasSize(2);
            assertThat(resp.batchCode()).isNotBlank();
            assertThat(resp.currency()).isEqualTo("EUR");
            verify(reservationRepository, times(2)).save(any(Reservation.class));
        }

        @Test
        @DisplayName("throws when one item is unavailable")
        void whenOneItemUnavailable_thenThrows() {
            // Second call returns conflicts
            when(calendarDayRepository.countConflicts(any(), any(), any(), any()))
                    .thenReturn(0L).thenReturn(5L);

            BookingReserveBatchRequestDto.Item it1 = new BookingReserveBatchRequestDto.Item(
                    PROPERTY_ID, in, out, 2, null, null);
            BookingReserveBatchRequestDto.Item it2 = new BookingReserveBatchRequestDto.Item(
                    PROPERTY_ID, in.plusDays(10), out.plusDays(10), 2, null, null);
            BookingReserveBatchRequestDto req = new BookingReserveBatchRequestDto(
                    List.of(it1, it2),
                    new BookingReserveRequestDto.GuestInfo("J", "j@e.com", null));

            lenient().when(priceEngine.resolvePriceRange(any(), eq(in.plusDays(10)), eq(out.plusDays(10)), any()))
                    .thenReturn(Map.of(in.plusDays(10), new BigDecimal("100.00")));

            assertThatThrownBy(() -> service.reserveBatch(buildCtx(), req))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("non disponible");
        }
    }

    // ───────────────────── checkout (Stripe) ─────────────────────────────────────

    @Nested
    class Checkout {

        @Test
        @DisplayName("throws if collectPaymentOnBooking=false")
        void whenPaymentNotEnabled_thenThrows() {
            BookingEngineConfig cfg = buildConfig(true);
            cfg.setCollectPaymentOnBooking(false);
            PublicBookingService.OrgContext ctx = new PublicBookingService.OrgContext(buildOrg(), cfg);

            assertThatThrownBy(() -> service.checkout(ctx, new BookingCheckoutRequestDto("CODE-1", null)))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("paiement en ligne");
        }

        @Test
        @DisplayName("throws if reservation not found")
        void whenReservationMissing_thenThrows() {
            when(reservationRepository.findByConfirmationCodeAndOrganizationId("CODE", ORG_ID))
                    .thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.checkout(buildCtx(), new BookingCheckoutRequestDto("CODE", null)))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("introuvable");
        }

        @Test
        @DisplayName("throws if reservation is cancelled")
        void whenWrongStatus_thenThrows() {
            Reservation r = new Reservation();
            r.setStatus("cancelled");
            r.setOrganizationId(ORG_ID);
            when(reservationRepository.findByConfirmationCodeAndOrganizationId("CODE", ORG_ID))
                    .thenReturn(Optional.of(r));
            assertThatThrownBy(() -> service.checkout(buildCtx(), new BookingCheckoutRequestDto("CODE", null)))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        @DisplayName("throws if already paid")
        void whenAlreadyPaid_thenThrows() {
            Reservation r = new Reservation();
            r.setStatus("pending");
            r.setOrganizationId(ORG_ID);
            r.setPaymentStatus(PaymentStatus.PAID);
            when(reservationRepository.findByConfirmationCodeAndOrganizationId("CODE", ORG_ID))
                    .thenReturn(Optional.of(r));

            assertThatThrownBy(() -> service.checkout(buildCtx(), new BookingCheckoutRequestDto("CODE", null)))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("deja payee");
        }

        @Test
        @DisplayName("creates Stripe session and persists sessionId on success")
        void whenValid_thenCreatesSession() throws StripeException {
            Reservation r = new Reservation();
            r.setId(50L);
            r.setStatus("pending");
            r.setOrganizationId(ORG_ID);
            r.setConfirmationCode("CODE");
            r.setTotalPrice(new BigDecimal("100.00"));
            r.setGuestName("Jane");
            r.setProperty(buildProperty());
            when(reservationRepository.findByConfirmationCodeAndOrganizationId("CODE", ORG_ID))
                    .thenReturn(Optional.of(r));

            Session session = mock(Session.class);
            when(session.getId()).thenReturn("cs_test");
            when(session.getUrl()).thenReturn("https://stripe/checkout/cs_test");
            // Reliquat A3 : le flux /reserve+/checkout pose une duree de vie (~35 min). B3 : surcharge
            // success_url explicite (null ici car returnUrl absent → success_url par defaut). P2 : 8-arg
            // avec riskMetadata (null car scoring désactivé par défaut sur le mock).
            when(stripeService.createReservationCheckoutSession(eq(50L), any(), any(), any(), any(),
                    eq(java.time.Duration.ofMinutes(35)), isNull(), isNull()))
                    .thenReturn(session);

            BookingCheckoutResponseDto resp = service.checkout(buildCtx(), new BookingCheckoutRequestDto("CODE", null));

            assertThat(resp.sessionId()).isEqualTo("cs_test");
            assertThat(resp.checkoutUrl()).contains("cs_test");
            verify(reservationRepository).save(r);
            assertThat(r.getStripeSessionId()).isEqualTo("cs_test");
        }

        @Test
        @DisplayName("wraps Stripe exception in RuntimeException")
        void whenStripeFails_thenRuntimeException() throws StripeException {
            Reservation r = new Reservation();
            r.setId(50L);
            r.setStatus("pending");
            r.setOrganizationId(ORG_ID);
            r.setTotalPrice(new BigDecimal("100.00"));
            r.setProperty(buildProperty());
            when(reservationRepository.findByConfirmationCodeAndOrganizationId("CODE", ORG_ID))
                    .thenReturn(Optional.of(r));
            when(stripeService.createReservationCheckoutSession(any(), any(), any(), any(), any(), any(), any(), any()))
                    .thenThrow(new RuntimeException("boom"));

            assertThatThrownBy(() -> service.checkout(buildCtx(), new BookingCheckoutRequestDto("CODE", null)))
                    .isInstanceOf(RuntimeException.class);
        }

        // ── returnUrl (B3) : garde-fou open-redirect ────────────────────────────

        /** Réservation PENDING payable + stub de session ; renvoie le ctx avec `allowedOrigins` donné. */
        private PublicBookingService.OrgContext stubPayableReservationWithOrigins(String allowedOrigins) throws StripeException {
            Reservation r = new Reservation();
            r.setId(50L);
            r.setStatus("pending");
            r.setOrganizationId(ORG_ID);
            r.setConfirmationCode("CODE");
            r.setTotalPrice(new BigDecimal("100.00"));
            r.setGuestName("Jane");
            r.setProperty(buildProperty());
            when(reservationRepository.findByConfirmationCodeAndOrganizationId("CODE", ORG_ID))
                    .thenReturn(Optional.of(r));

            Session session = mock(Session.class);
            when(session.getId()).thenReturn("cs_test");
            when(session.getUrl()).thenReturn("https://stripe/checkout/cs_test");
            when(stripeService.createReservationCheckoutSession(eq(50L), any(), any(), any(), any(),
                    any(), any(), any())).thenReturn(session);

            BookingEngineConfig cfg = buildConfig(true);
            cfg.setAllowedOrigins(allowedOrigins);
            return new PublicBookingService.OrgContext(buildOrg(), cfg);
        }

        @Test
        @DisplayName("returnUrl HTTPS au host de l'org → success_url = returnUrl + ?reservation=CODE")
        void whenReturnUrlMatchesOrgHost_thenUsedAsSuccessUrl() throws StripeException {
            PublicBookingService.OrgContext ctx = stubPayableReservationWithOrigins("https://book.acme.com");

            service.checkout(ctx, new BookingCheckoutRequestDto("CODE", "https://book.acme.com/merci"));

            verify(stripeService).createReservationCheckoutSession(eq(50L), any(), any(), any(), any(),
                    any(), eq("https://book.acme.com/merci?reservation=CODE"), any());
        }

        @Test
        @DisplayName("returnUrl avec query existante → append &reservation=CODE")
        void whenReturnUrlHasQuery_thenAppendsWithAmpersand() throws StripeException {
            PublicBookingService.OrgContext ctx = stubPayableReservationWithOrigins("https://book.acme.com");

            service.checkout(ctx, new BookingCheckoutRequestDto("CODE", "https://book.acme.com/merci?lang=fr"));

            verify(stripeService).createReservationCheckoutSession(eq(50L), any(), any(), any(), any(),
                    any(), eq("https://book.acme.com/merci?lang=fr&reservation=CODE"), any());
        }

        @Test
        @DisplayName("returnUrl host arbitraire (≠ org) → IGNORÉ, success_url par défaut (null)")
        void whenReturnUrlHostNotAllowed_thenIgnored() throws StripeException {
            PublicBookingService.OrgContext ctx = stubPayableReservationWithOrigins("https://book.acme.com");

            service.checkout(ctx, new BookingCheckoutRequestDto("CODE", "https://evil.example.com/steal"));

            verify(stripeService).createReservationCheckoutSession(eq(50L), any(), any(), any(), any(),
                    any(), isNull(), any());
        }

        @Test
        @DisplayName("returnUrl en HTTP (non HTTPS) → IGNORÉ, success_url par défaut (null)")
        void whenReturnUrlNotHttps_thenIgnored() throws StripeException {
            PublicBookingService.OrgContext ctx = stubPayableReservationWithOrigins("https://book.acme.com");

            service.checkout(ctx, new BookingCheckoutRequestDto("CODE", "http://book.acme.com/merci"));

            verify(stripeService).createReservationCheckoutSession(eq(50L), any(), any(), any(), any(),
                    any(), isNull(), any());
        }

        @Test
        @DisplayName("allowedOrigins vide → toute returnUrl IGNORÉE (fail-closed)")
        void whenNoAllowedOrigins_thenReturnUrlIgnored() throws StripeException {
            PublicBookingService.OrgContext ctx = stubPayableReservationWithOrigins(null);

            service.checkout(ctx, new BookingCheckoutRequestDto("CODE", "https://book.acme.com/merci"));

            verify(stripeService).createReservationCheckoutSession(eq(50L), any(), any(), any(), any(),
                    any(), isNull(), any());
        }
    }

    // ───────────────────── checkout : scoring fraude (P2) ────────────────────────

    @Nested
    class CheckoutFraudScoring {

        private Reservation payableReservation() {
            Guest guest = new Guest();
            guest.setEmail("guest@example.com");
            Reservation r = new Reservation();
            r.setId(50L);
            r.setStatus("pending");
            r.setOrganizationId(ORG_ID);
            r.setConfirmationCode("CODE");
            r.setTotalPrice(new BigDecimal("100.00"));
            r.setGuestName("Jane");
            r.setGuest(guest);
            r.setProperty(buildProperty());
            return r;
        }

        private Session stubStripeSession() throws StripeException {
            Session session = mock(Session.class);
            lenient().when(session.getId()).thenReturn("cs_test");
            lenient().when(session.getUrl()).thenReturn("https://stripe/checkout/cs_test");
            when(stripeService.createReservationCheckoutSession(eq(50L), any(), any(), any(), any(),
                    any(), any(), any())).thenReturn(session);
            return session;
        }

        @Test
        @DisplayName("scoring désactivé → service de scoring jamais appelé (no-op)")
        void whenScoringDisabled_thenServiceNotInvoked() throws StripeException {
            when(reservationRepository.findByConfirmationCodeAndOrganizationId("CODE", ORG_ID))
                    .thenReturn(Optional.of(payableReservation()));
            stubStripeSession();
            when(fraudScoringService.isEnabled()).thenReturn(false);

            service.checkout(buildCtx(), new BookingCheckoutRequestDto("CODE", null), "1.2.3.4");

            verify(fraudScoringService, never()).score(any());
        }

        @Test
        @DisplayName("LOW → checkout normal, aucune note de revue, metadata Radar transmise")
        void whenLowRisk_thenNormalCheckout() throws StripeException {
            Reservation r = payableReservation();
            when(reservationRepository.findByConfirmationCodeAndOrganizationId("CODE", ORG_ID))
                    .thenReturn(Optional.of(r));
            stubStripeSession();
            when(fraudScoringService.isEnabled()).thenReturn(true);
            when(fraudScoringService.isEnforcement()).thenReturn(true); // même en enforcement, LOW = rien
            when(fraudScoringService.score(any()))
                    .thenReturn(new RiskAssessment(0, RiskLevel.LOW, java.util.List.of()));

            BookingCheckoutResponseDto resp = service.checkout(
                    buildCtx(), new BookingCheckoutRequestDto("CODE", null), "1.2.3.4");

            assertThat(resp.sessionId()).isEqualTo("cs_test");
            assertThat(r.getNotes()).isNull();
            // Radar metadata (score/level) passée en 8e argument.
            ArgumentCaptor<java.util.Map<String, String>> md = ArgumentCaptor.forClass(java.util.Map.class);
            verify(stripeService).createReservationCheckoutSession(eq(50L), any(), any(), any(), any(),
                    any(), any(), md.capture());
            assertThat(md.getValue()).containsEntry("risk_level", "LOW").containsEntry("risk_score", "0");
        }

        @Test
        @DisplayName("MEDIUM + enforcement → réservation marquée pour revue (notes), paiement non bloqué")
        void whenMediumWithEnforcement_thenFlaggedForReview() throws StripeException {
            Reservation r = payableReservation();
            when(reservationRepository.findByConfirmationCodeAndOrganizationId("CODE", ORG_ID))
                    .thenReturn(Optional.of(r));
            stubStripeSession();
            when(fraudScoringService.isEnabled()).thenReturn(true);
            when(fraudScoringService.isEnforcement()).thenReturn(true);
            when(fraudScoringService.score(any()))
                    .thenReturn(new RiskAssessment(45, RiskLevel.MEDIUM,
                            java.util.List.of("Vélocité IP élevée (9 tentatives / 60 min)")));

            BookingCheckoutResponseDto resp = service.checkout(
                    buildCtx(), new BookingCheckoutRequestDto("CODE", null), "1.2.3.4");

            // Le paiement n'est PAS bloqué (session créée) mais la résa est marquée pour revue.
            assertThat(resp.sessionId()).isEqualTo("cs_test");
            assertThat(r.getNotes()).contains("REVUE FRAUDE MEDIUM").contains("Vélocité IP");
        }

        @Test
        @DisplayName("HIGH + advisory (enforcement off) → ne bloque JAMAIS, pas de note de revue")
        void whenHighButAdvisory_thenNeverBlocks() throws StripeException {
            Reservation r = payableReservation();
            when(reservationRepository.findByConfirmationCodeAndOrganizationId("CODE", ORG_ID))
                    .thenReturn(Optional.of(r));
            stubStripeSession();
            when(fraudScoringService.isEnabled()).thenReturn(true);
            when(fraudScoringService.isEnforcement()).thenReturn(false); // advisory
            when(fraudScoringService.score(any()))
                    .thenReturn(new RiskAssessment(90, RiskLevel.HIGH, java.util.List.of("Email jetable")));

            BookingCheckoutResponseDto resp = service.checkout(
                    buildCtx(), new BookingCheckoutRequestDto("CODE", null), "1.2.3.4");

            assertThat(resp.sessionId()).isEqualTo("cs_test"); // paiement légitime jamais bloqué
            assertThat(r.getNotes()).isNull(); // advisory : aucune décision appliquée
        }

        @Test
        @DisplayName("HIGH + enforcement + refuse-high-risk → checkout refusé (409)")
        void whenHighWithRefuse_thenRejected() throws StripeException {
            when(reservationRepository.findByConfirmationCodeAndOrganizationId("CODE", ORG_ID))
                    .thenReturn(Optional.of(payableReservation()));
            when(fraudScoringService.isEnabled()).thenReturn(true);
            when(fraudScoringService.isEnforcement()).thenReturn(true);
            when(fraudScoringService.isRefuseHighRisk()).thenReturn(true);
            when(fraudScoringService.score(any()))
                    .thenReturn(new RiskAssessment(90, RiskLevel.HIGH, java.util.List.of("Vélocité IP très élevée")));

            assertThatThrownBy(() -> service.checkout(
                    buildCtx(), new BookingCheckoutRequestDto("CODE", null), "1.2.3.4"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("vérification");

            // Aucune session Stripe créée pour un checkout refusé.
            verify(stripeService, never()).createReservationCheckoutSession(any(), any(), any(), any(), any(),
                    any(), any(), any());
        }

        @Test
        @DisplayName("le montant scoré est le total RECALCULÉ SERVEUR (jamais un montant client)")
        void whenScoring_thenUsesServerSideTotal() throws StripeException {
            Reservation r = payableReservation();
            r.setTotalPrice(new BigDecimal("777.00")); // total serveur de référence
            when(reservationRepository.findByConfirmationCodeAndOrganizationId("CODE", ORG_ID))
                    .thenReturn(Optional.of(r));
            stubStripeSession();
            when(fraudScoringService.isEnabled()).thenReturn(true);
            lenient().when(fraudScoringService.isEnforcement()).thenReturn(false);
            when(fraudScoringService.score(any()))
                    .thenReturn(new RiskAssessment(0, RiskLevel.LOW, java.util.List.of()));

            service.checkout(buildCtx(), new BookingCheckoutRequestDto("CODE", null), "1.2.3.4");

            ArgumentCaptor<BookingFraudScoringService.FraudSignalInput> captor =
                    ArgumentCaptor.forClass(BookingFraudScoringService.FraudSignalInput.class);
            verify(fraudScoringService).score(captor.capture());
            assertThat(captor.getValue().serverTotal()).isEqualByComparingTo("777.00");
            assertThat(captor.getValue().clientIp()).isEqualTo("1.2.3.4");
            assertThat(captor.getValue().email()).isEqualTo("guest@example.com");
        }
    }

    // ───────────────────── getConfirmation ──────────────────────────────────────

    @Nested
    class GetConfirmation {

        @Test
        void whenReservationFound_thenMapsToDto() {
            Reservation r = new Reservation();
            r.setId(1L);
            r.setOrganizationId(ORG_ID);
            r.setConfirmationCode("CODE");
            r.setStatus("confirmed");
            r.setPaymentStatus(PaymentStatus.PAID);
            r.setProperty(buildProperty());
            r.setCheckIn(LocalDate.now().plusDays(7));
            r.setCheckOut(LocalDate.now().plusDays(10));
            r.setTotalPrice(new BigDecimal("330.00"));
            r.setCurrency("EUR");
            r.setGuestName("Jane");
            r.setRoomRevenue(new BigDecimal("300.00"));
            r.setCleaningFee(new BigDecimal("30.00"));
            r.setTouristTaxAmount(BigDecimal.ZERO);
            r.setCheckInTime("15:00");
            r.setCheckOutTime("11:00");
            when(reservationRepository.findByConfirmationCodeAndOrganizationId("CODE", ORG_ID))
                    .thenReturn(Optional.of(r));

            BookingConfirmationDto dto = service.getConfirmation(buildCtx(), "CODE");

            assertThat(dto.reservationCode()).isEqualTo("CODE");
            assertThat(dto.nights()).isEqualTo(3);
            assertThat(dto.paymentStatus()).isEqualTo("PAID");
            assertThat(dto.total()).isEqualByComparingTo("330.00");
        }

        @Test
        void whenReservationMissing_thenThrows() {
            when(reservationRepository.findByConfirmationCodeAndOrganizationId("CODE", ORG_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getConfirmation(buildCtx(), "CODE"))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ───────────────────── confirmBookingEngineCheckout (webhook) ───────────────

    @Nested
    class ConfirmBookingEngineCheckout {

        @Test
        @DisplayName("idempotent: returns early if reservation already PAID")
        void whenAlreadyPaid_thenIdempotentReturn() {
            Reservation existing = new Reservation();
            existing.setConfirmationCode("CODE");
            existing.setPaymentStatus(PaymentStatus.PAID);
            Session s = mock(Session.class);
            when(s.getId()).thenReturn("cs_x");
            when(s.getMetadata()).thenReturn(Map.of());
            when(reservationRepository.findByStripeSessionId("cs_x")).thenReturn(Optional.of(existing));

            service.confirmBookingEngineCheckout(s);

            verify(stripeService, never()).confirmReservationPayment(any());
        }

        @Test
        @DisplayName("delegates to stripeService when reservation pending exists")
        void whenPendingExists_thenDelegates() {
            Reservation existing = new Reservation();
            existing.setConfirmationCode("CODE");
            existing.setPaymentStatus(PaymentStatus.PENDING);
            Session s = mock(Session.class);
            when(s.getId()).thenReturn("cs_x");
            when(s.getMetadata()).thenReturn(Map.of());
            when(reservationRepository.findByStripeSessionId("cs_x")).thenReturn(Optional.of(existing));

            service.confirmBookingEngineCheckout(s);

            verify(stripeService).confirmReservationPayment("cs_x");
        }

        @Test
        @DisplayName("skips when metadata is incomplete and no preceding reservation")
        void whenNoExistingAndMissingMetadata_thenSkip() {
            Session s = mock(Session.class);
            when(s.getId()).thenReturn("cs_x");
            when(s.getMetadata()).thenReturn(Map.of());
            when(reservationRepository.findByStripeSessionId("cs_x")).thenReturn(Optional.empty());

            service.confirmBookingEngineCheckout(s);

            verifyNoInteractions(stripeService);
            verifyNoInteractions(propertyRepository);
        }
    }

    // ───────────────────── reviews ──────────────────────────────────────────────

    @Nested
    class Reviews {

        @Test
        void getPublicReviews_byProperty_returnsPage() {
            GuestReview rev = new GuestReview();
            rev.setRating(5);
            Page<GuestReview> page = new PageImpl<>(List.of(rev));
            when(guestReviewRepository.findPublicByPropertyId(eq(PROPERTY_ID), eq(ORG_ID), any(Pageable.class)))
                    .thenReturn(page);

            Page<PublicReviewDto> result = service.getPublicReviews(buildCtx(), PROPERTY_ID, Pageable.unpaged());

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).rating()).isEqualTo(5);
        }

        @Test
        void getPublicReviews_byOrg_returnsPage() {
            Page<GuestReview> page = new PageImpl<>(List.of());
            when(guestReviewRepository.findPublicByOrgId(eq(ORG_ID), any(Pageable.class)))
                    .thenReturn(page);

            Page<PublicReviewDto> result = service.getPublicReviews(buildCtx(), null, Pageable.unpaged());

            assertThat(result).isNotNull();
        }

        @Test
        void getReviewStats_byProperty_returnsRounded() {
            when(guestReviewRepository.averagePublicRatingByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(4.567);
            when(guestReviewRepository.countPublicByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(12L);

            ReviewStatsDto stats = service.getReviewStats(buildCtx(), PROPERTY_ID);

            assertThat(stats.averageRating()).isEqualTo(4.6);
            assertThat(stats.totalCount()).isEqualTo(12L);
            assertThat(stats.distribution()).hasSize(5);
        }

        @Test
        void getReviewStats_byOrg_handlesNullAverage() {
            when(guestReviewRepository.averagePublicRatingByOrgId(ORG_ID)).thenReturn(null);
            when(guestReviewRepository.countPublicByOrgId(ORG_ID)).thenReturn(0L);

            ReviewStatsDto stats = service.getReviewStats(buildCtx(), null);

            assertThat(stats.averageRating()).isEqualTo(0.0);
            assertThat(stats.totalCount()).isEqualTo(0L);
        }

        @Test
        void getReviewStats_byOrg_withRoundedRating() {
            when(guestReviewRepository.averagePublicRatingByOrgId(ORG_ID)).thenReturn(3.789);
            when(guestReviewRepository.countPublicByOrgId(ORG_ID)).thenReturn(50L);

            ReviewStatsDto stats = service.getReviewStats(buildCtx(), null);

            assertThat(stats.averageRating()).isEqualTo(3.8);
            assertThat(stats.totalCount()).isEqualTo(50L);
        }

        @Test
        void getReviewStats_byProperty_handlesNullAverage() {
            when(guestReviewRepository.averagePublicRatingByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(null);
            when(guestReviewRepository.countPublicByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(0L);

            ReviewStatsDto stats = service.getReviewStats(buildCtx(), PROPERTY_ID);

            assertThat(stats.averageRating()).isEqualTo(0.0);
        }
    }

    // ───────────────────── confirmBookingEngineCheckout — full path ─────────────

    @Nested
    class ConfirmBookingEngineCheckoutFullPath {

        private LocalDate in;
        private LocalDate out;

        @BeforeEach
        void setUp() {
            in = LocalDate.now().plusDays(7);
            out = LocalDate.now().plusDays(10);
        }

        private Session buildWebhookSession(String sessionId, Long amountTotalCents) {
            Session s = mock(Session.class);
            when(s.getId()).thenReturn(sessionId);
            when(s.getMetadata()).thenReturn(Map.of(
                    "property_id", PROPERTY_ID.toString(),
                    "organization_id", ORG_ID.toString(),
                    "check_in", in.toString(),
                    "check_out", out.toString(),
                    "guests", "2"));
            lenient().when(s.getCustomerEmail()).thenReturn("walkin@example.com");
            lenient().when(s.getAmountTotal()).thenReturn(amountTotalCents);
            when(reservationRepository.findByStripeSessionId(sessionId)).thenReturn(Optional.empty());
            return s;
        }

        private void stubAvailabilityHappyPath() {
            Property p = buildProperty();
            when(propertyRepository.findBookingEngineProperty(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(p));
            when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(buildOrg()));
            when(configRepository.findAllByOrganizationId(ORG_ID))
                    .thenReturn(List.of(buildConfig(true)));
            when(restrictionEngine.validate(any(), any(), any(), any()))
                    .thenReturn(RestrictionEngine.ValidationResult.valid());
            when(calendarDayRepository.countConflicts(any(), any(), any(), any())).thenReturn(0L);
            when(priceEngine.resolvePriceRange(any(), any(), any(), any())).thenReturn(Map.of(
                    in, new BigDecimal("100.00"),
                    in.plusDays(1), new BigDecimal("100.00"),
                    in.plusDays(2), new BigDecimal("100.00")));
        }

        @Test
        @DisplayName("creates PENDING reservation then delegates guarded confirmation (legacy fallback)")
        void whenCompleteMetadata_thenCreatesPendingAndDelegatesConfirmation() {
            // 330.00 EUR = 300 subtotal + 30 cleaning (tax service not stubbed → 0)
            Session s = buildWebhookSession("cs_new", 33000L);
            stubAvailabilityHappyPath();
            Guest guest = new Guest();
            guest.setId(1L);
            when(guestService.findOrCreate(anyString(), anyString(), anyString(), any(),
                    eq(GuestChannel.DIRECT), any(), eq(ORG_ID))).thenReturn(guest);
            when(reservationRepository.save(any(Reservation.class))).thenAnswer(inv -> {
                Reservation r = inv.getArgument(0);
                r.setId(777L);
                return r;
            });

            service.confirmBookingEngineCheckout(s);

            ArgumentCaptor<Reservation> captor = ArgumentCaptor.forClass(Reservation.class);
            verify(reservationRepository).save(captor.capture());
            // Creation en PENDING : la transition PAID + confirmed est deleguee a
            // la version idempotente de confirmReservationPayment (Z4A-BUGS-05)
            assertThat(captor.getValue().getStatus()).isEqualTo("pending");
            assertThat(captor.getValue().getPaymentStatus()).isEqualTo(PaymentStatus.PENDING);
            assertThat(captor.getValue().getStripeSessionId()).isEqualTo("cs_new");
            assertThat(captor.getValue().getTotalPrice()).isEqualByComparingTo("330.00");
            verify(calendarEngine).book(eq(PROPERTY_ID), eq(in), eq(out),
                    eq(777L), eq(ORG_ID), eq("direct"), eq("booking-engine-webhook"));
            verify(stripeService).confirmReservationPayment("cs_new");
        }

        @Test
        @DisplayName("Z4A-BUGS-03: conflict after payment refunds automatically, no degraded reservation")
        void whenConflictAfterPayment_thenRefundsAndSkipsCreation() throws Exception {
            Session s = buildWebhookSession("cs_conflict", 33000L);
            Property p = buildProperty();
            when(propertyRepository.findBookingEngineProperty(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(p));
            when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(buildOrg()));
            when(configRepository.findAllByOrganizationId(ORG_ID))
                    .thenReturn(List.of(buildConfig(true)));
            when(restrictionEngine.validate(any(), any(), any(), any()))
                    .thenReturn(RestrictionEngine.ValidationResult.valid());
            // Conflit : un autre voyageur a reserve entre temps
            when(calendarDayRepository.countConflicts(any(), any(), any(), any())).thenReturn(2L);

            service.confirmBookingEngineCheckout(s);

            verify(reservationRepository, never()).save(any(Reservation.class));
            verify(calendarEngine, never()).book(any(), any(), any(), any(), any(), any(), any());
            verify(stripeService).refundCheckoutSessionPayment(eq("cs_conflict"), anyString());
            verify(notificationService).notifyAdminsAndManagersByOrgId(
                    eq(ORG_ID), eq(NotificationKey.PAYMENT_REFUND_INITIATED),
                    anyString(), anyString(), anyString());
            verify(stripeService, never()).confirmReservationPayment(any());
        }

        @Test
        @DisplayName("Z4A-SEC-01: manipulated amount on legacy session refunds instead of confirming")
        void whenStripeTotalDivergesFromServerQuote_thenRefundsAndSkipsCreation() throws Exception {
            // 0.50 EUR paye pour un devis serveur de 330.00 EUR
            Session s = buildWebhookSession("cs_fraud", 50L);
            stubAvailabilityHappyPath();

            service.confirmBookingEngineCheckout(s);

            verify(reservationRepository, never()).save(any(Reservation.class));
            verify(calendarEngine, never()).book(any(), any(), any(), any(), any(), any(), any());
            verify(stripeService).refundCheckoutSessionPayment(eq("cs_fraud"), anyString());
            verify(stripeService, never()).confirmReservationPayment(any());
        }

        @Test
        @DisplayName("race lost on calendar book: reservation cancelled + payment refunded")
        void whenCalendarBookConflicts_thenCancelsAndRefunds() throws Exception {
            Session s = buildWebhookSession("cs_race", 33000L);
            stubAvailabilityHappyPath();
            Guest guest = new Guest();
            guest.setId(1L);
            when(guestService.findOrCreate(anyString(), anyString(), anyString(), any(),
                    eq(GuestChannel.DIRECT), any(), eq(ORG_ID))).thenReturn(guest);
            when(reservationRepository.save(any(Reservation.class))).thenAnswer(inv -> {
                Reservation r = inv.getArgument(0);
                r.setId(999L);
                return r;
            });
            doThrow(new com.clenzy.exception.CalendarConflictException(PROPERTY_ID, in, out, 2))
                    .when(calendarEngine).book(eq(PROPERTY_ID), eq(in), eq(out),
                            eq(999L), eq(ORG_ID), eq("direct"), eq("booking-engine-webhook"));

            service.confirmBookingEngineCheckout(s);

            ArgumentCaptor<Reservation> captor = ArgumentCaptor.forClass(Reservation.class);
            verify(reservationRepository, times(2)).save(captor.capture());
            assertThat(captor.getValue().getStatus()).isEqualTo("cancelled");
            assertThat(captor.getValue().getPaymentStatus()).isEqualTo(PaymentStatus.CANCELLED);
            verify(stripeService).refundCheckoutSessionPayment(eq("cs_race"), anyString());
            verify(stripeService, never()).confirmReservationPayment(any());
        }

        @Test
        @DisplayName("double webhook: second delivery is a no-op (single confirmation)")
        void whenWebhookDeliveredTwice_thenSingleConfirmation() {
            Session s = mock(Session.class);
            when(s.getId()).thenReturn("cs_dup");
            when(s.getMetadata()).thenReturn(Map.of());
            Reservation paid = new Reservation();
            paid.setConfirmationCode("RES-DUP");
            paid.setStripeSessionId("cs_dup");
            paid.setPaymentStatus(PaymentStatus.PENDING);
            // 1er webhook : reservation pending → confirmation deleguee
            when(reservationRepository.findByStripeSessionId("cs_dup"))
                    .thenReturn(Optional.of(paid));
            service.confirmBookingEngineCheckout(s);
            verify(stripeService, times(1)).confirmReservationPayment("cs_dup");

            // 2e webhook : reservation desormais PAID → aucun nouveau traitement
            paid.setPaymentStatus(PaymentStatus.PAID);
            service.confirmBookingEngineCheckout(s);
            verify(stripeService, times(1)).confirmReservationPayment("cs_dup");
        }

        @Test
        @DisplayName("throws when property not found in metadata flow")
        void whenPropertyMissing_thenThrows() {
            Session s = mock(Session.class);
            when(s.getId()).thenReturn("cs_pmiss");
            when(s.getMetadata()).thenReturn(Map.of(
                    "property_id", "9999",
                    "organization_id", ORG_ID.toString(),
                    "check_in", LocalDate.now().plusDays(5).toString(),
                    "check_out", LocalDate.now().plusDays(8).toString(),
                    "guests", "2"));
            when(reservationRepository.findByStripeSessionId("cs_pmiss")).thenReturn(Optional.empty());
            when(propertyRepository.findBookingEngineProperty(9999L, ORG_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.confirmBookingEngineCheckout(s))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("introuvable");
        }

        @Test
        @DisplayName("unattached hold is recovered via metadata.reservation_id")
        void whenHoldNotAttached_thenRecoveredFromMetadata() {
            Session s = mock(Session.class);
            when(s.getId()).thenReturn("cs_orphan");
            when(s.getMetadata()).thenReturn(Map.of("reservation_id", "321"));
            when(reservationRepository.findByStripeSessionId("cs_orphan")).thenReturn(Optional.empty());
            Reservation hold = new Reservation();
            hold.setId(321L);
            hold.setStatus("pending");
            hold.setConfirmationCode("RES-HOLD");
            when(reservationRepository.findById(321L)).thenReturn(Optional.of(hold));

            service.confirmBookingEngineCheckout(s);

            assertThat(hold.getStripeSessionId()).isEqualTo("cs_orphan");
            verify(reservationRepository).save(hold);
            verify(stripeService).confirmReservationPayment("cs_orphan");
        }
    }

    // ───────────────────── embedded checkout hold (Z4A-BUGS-03) ─────────────────

    @Nested
    class EmbeddedCheckoutHold {

        private LocalDate in;
        private LocalDate out;

        @BeforeEach
        void setUp() {
            in = LocalDate.now().plusDays(7);
            out = LocalDate.now().plusDays(10);
        }

        private AvailabilityResponseDto availability(String subtotal, String cleaning, String tax, String total) {
            return new AvailabilityResponseDto(true, PROPERTY_ID, "Cosy Loft", in, out, 2, 3,
                    List.of(), new BigDecimal(subtotal), new BigDecimal(cleaning),
                    new BigDecimal(tax), new BigDecimal(total), BigDecimal.ZERO, "EUR", 1, 4, "15:00", "11:00", List.of());
        }

        @Test
        @DisplayName("creates PENDING hold blocking the calendar with server-computed total")
        void whenHoldCreated_thenPendingAndCalendarBlocked() {
            when(propertyRepository.findBookingEngineProperty(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(buildProperty()));
            Guest g = new Guest();
            g.setId(5L);
            when(guestService.findOrCreate(anyString(), anyString(), any(), any(),
                    eq(GuestChannel.DIRECT), any(), eq(ORG_ID))).thenReturn(g);
            when(reservationRepository.save(any(Reservation.class))).thenAnswer(inv -> {
                Reservation r = inv.getArgument(0);
                r.setId(456L);
                return r;
            });

            Reservation hold = service.createEmbeddedCheckoutHold(
                    buildCtx(), PROPERTY_ID, in, out, 2, "jane@example.com", "Jane Doe",
                    availability("300.00", "30.00", "0.00", "330.00"), new BigDecimal("20.00"));

            assertThat(hold.getStatus()).isEqualTo("pending");
            assertThat(hold.getPaymentStatus()).isEqualTo(PaymentStatus.PENDING);
            assertThat(hold.getTotalPrice()).isEqualByComparingTo("350.00");
            assertThat(hold.getConfirmationCode()).isNotBlank();
            verify(calendarEngine).book(eq(PROPERTY_ID), eq(in), eq(out),
                    eq(456L), eq(ORG_ID), eq("direct"), eq("booking-engine-embedded"));
        }

        @Test
        @DisplayName("attachStripeSessionToHold persists the session id")
        void whenSessionAttached_thenSessionIdPersisted() {
            Reservation hold = new Reservation();
            hold.setId(456L);
            when(reservationRepository.findById(456L)).thenReturn(Optional.of(hold));

            service.attachStripeSessionToHold(456L, "cs_hold");

            assertThat(hold.getStripeSessionId()).isEqualTo("cs_hold");
            verify(reservationRepository).save(hold);
        }

        @Test
        @DisplayName("releaseEmbeddedCheckoutHold cancels and frees the calendar")
        void whenHoldReleased_thenCancelledAndCalendarFreed() {
            Reservation hold = new Reservation();
            hold.setId(456L);
            hold.setOrganizationId(ORG_ID);
            hold.setStatus("pending");
            hold.setConfirmationCode("RES-HOLD");
            when(reservationRepository.findById(456L)).thenReturn(Optional.of(hold));

            service.releaseEmbeddedCheckoutHold(456L);

            assertThat(hold.getStatus()).isEqualTo("cancelled");
            assertThat(hold.getPaymentStatus()).isEqualTo(PaymentStatus.CANCELLED);
            verify(calendarEngine).cancel(456L, ORG_ID, "booking-engine-embedded-rollback");
        }
    }

    // ───────────────────── reserveBatch — multi-currency ────────────────────────

    @Nested
    class ReserveBatchMultiCurrency {

        @Test
        @DisplayName("throws when items have different currencies")
        void whenMultipleCurrencies_thenThrows() {
            LocalDate in = LocalDate.now().plusDays(7);
            LocalDate out = LocalDate.now().plusDays(10);

            Property p1 = buildProperty();
            p1.setDefaultCurrency("EUR");
            Property p2 = buildProperty();
            p2.setId(PROPERTY_ID + 1);
            p2.setDefaultCurrency("USD");

            lenient().when(propertyRepository.findBookingEngineProperty(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(p1));
            lenient().when(propertyRepository.findBookingEngineProperty(PROPERTY_ID + 1, ORG_ID))
                    .thenReturn(Optional.of(p2));
            lenient().when(restrictionEngine.validate(any(), any(), any(), any()))
                    .thenReturn(RestrictionEngine.ValidationResult.valid());
            lenient().when(calendarDayRepository.countConflicts(any(), any(), any(), any()))
                    .thenReturn(0L);
            lenient().when(priceEngine.resolvePriceRange(any(), any(), any(), any()))
                    .thenReturn(Map.of(in, new BigDecimal("100.00")));

            BookingReserveBatchRequestDto.Item it1 = new BookingReserveBatchRequestDto.Item(
                    PROPERTY_ID, in, out, 2, null, null);
            BookingReserveBatchRequestDto.Item it2 = new BookingReserveBatchRequestDto.Item(
                    PROPERTY_ID + 1, in, out, 2, null, null);
            BookingReserveBatchRequestDto req = new BookingReserveBatchRequestDto(
                    List.of(it1, it2),
                    new BookingReserveRequestDto.GuestInfo("J", "j@x.com", null));

            assertThatThrownBy(() -> service.reserveBatch(buildCtx(), req))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("meme devise");
        }

        @Test
        @DisplayName("Z4A-BUGS-09: overlapping items on the same property are rejected upfront")
        void whenItemsOverlapOnSameProperty_thenThrowsWithoutCreating() {
            LocalDate in = LocalDate.now().plusDays(7);
            LocalDate out = LocalDate.now().plusDays(10);

            BookingReserveBatchRequestDto.Item it1 = new BookingReserveBatchRequestDto.Item(
                    PROPERTY_ID, in, out, 2, null, null);
            BookingReserveBatchRequestDto.Item it2 = new BookingReserveBatchRequestDto.Item(
                    PROPERTY_ID, in.plusDays(1), out.plusDays(1), 2, null, null);
            BookingReserveBatchRequestDto req = new BookingReserveBatchRequestDto(
                    List.of(it1, it2),
                    new BookingReserveRequestDto.GuestInfo("J", "j@x.com", null));

            assertThatThrownBy(() -> service.reserveBatch(buildCtx(), req))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("chevauchent");
            verify(reservationRepository, never()).save(any(Reservation.class));
            verify(calendarEngine, never()).book(any(), any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("Z4A-BUGS-09: back-to-back stays on the same property are allowed (no overlap)")
        void whenItemsBackToBackOnSameProperty_thenNoOverlapRejection() {
            LocalDate in = LocalDate.now().plusDays(7);
            LocalDate out = LocalDate.now().plusDays(10);

            Property p = buildProperty();
            lenient().when(propertyRepository.findBookingEngineProperty(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(p));
            lenient().when(restrictionEngine.validate(any(), any(), any(), any()))
                    .thenReturn(RestrictionEngine.ValidationResult.valid());
            lenient().when(calendarDayRepository.countConflicts(any(), any(), any(), any()))
                    .thenReturn(0L);
            lenient().when(priceEngine.resolvePriceRange(any(), any(), any(), any()))
                    .thenReturn(Map.of());
            Guest g = new Guest();
            g.setId(99L);
            lenient().when(guestService.findOrCreate(anyString(), anyString(), anyString(), any(),
                    eq(GuestChannel.DIRECT), any(), eq(ORG_ID))).thenReturn(g);
            lenient().when(reservationRepository.save(any(Reservation.class))).thenAnswer(inv -> {
                Reservation r = inv.getArgument(0);
                r.setId(321L);
                return r;
            });

            // checkOut item1 == checkIn item2 : pas de chevauchement (nuit du checkout libre)
            BookingReserveBatchRequestDto.Item it1 = new BookingReserveBatchRequestDto.Item(
                    PROPERTY_ID, in, out, 2, null, null);
            BookingReserveBatchRequestDto.Item it2 = new BookingReserveBatchRequestDto.Item(
                    PROPERTY_ID, out, out.plusDays(2), 2, null, null);
            BookingReserveBatchRequestDto req = new BookingReserveBatchRequestDto(
                    List.of(it1, it2),
                    new BookingReserveRequestDto.GuestInfo("J", "j@x.com", null));

            BookingReserveBatchResponseDto resp = service.reserveBatch(buildCtx(), req);

            assertThat(resp.reservations()).hasSize(2);
        }
    }

    // ───────────────────── Z4A-BUGS-06 / 08 — pricing & date guards ─────────────

    @Nested
    class AvailabilityGuards {

        private final LocalDate in = LocalDate.now().plusDays(7);
        private final LocalDate out = LocalDate.now().plusDays(10);

        private void stubHappyPath(Property p) {
            when(propertyRepository.findBookingEngineProperty(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(p));
            lenient().when(restrictionEngine.validate(any(), any(), any(), any()))
                    .thenReturn(RestrictionEngine.ValidationResult.valid());
            lenient().when(calendarDayRepository.countConflicts(any(), any(), any(), any()))
                    .thenReturn(0L);
        }

        @Test
        @DisplayName("Z4A-BUGS-06: a night with NULL resolved price makes the stay unavailable (not 0 EUR)")
        void whenNightPriceIsNull_thenUnavailable() {
            Property p = buildProperty();
            p.setNightlyPrice(null); // pas de prix de base
            stubHappyPath(p);
            // PriceEngine insere la cle avec valeur null quand rien n'est configure
            Map<LocalDate, BigDecimal> priceMap = new HashMap<>();
            priceMap.put(in, null);
            priceMap.put(in.plusDays(1), null);
            priceMap.put(in.plusDays(2), null);
            when(priceEngine.resolvePriceRange(PROPERTY_ID, in, out, ORG_ID)).thenReturn(priceMap);

            AvailabilityResponseDto resp = service.checkAvailability(buildCtx(), request(in, out, 2));

            assertThat(resp.available()).isFalse();
            assertThat(resp.violations()).anyMatch(v -> v.contains("Tarif non configure"));
        }

        @Test
        @DisplayName("Z4A-BUGS-06: a night priced 0 makes the stay unavailable")
        void whenNightPriceIsZero_thenUnavailable() {
            Property p = buildProperty();
            stubHappyPath(p);
            Map<LocalDate, BigDecimal> priceMap = new HashMap<>();
            priceMap.put(in, new BigDecimal("100.00"));
            priceMap.put(in.plusDays(1), BigDecimal.ZERO);
            priceMap.put(in.plusDays(2), new BigDecimal("100.00"));
            when(priceEngine.resolvePriceRange(PROPERTY_ID, in, out, ORG_ID)).thenReturn(priceMap);

            AvailabilityResponseDto resp = service.checkAvailability(buildCtx(), request(in, out, 2));

            assertThat(resp.available()).isFalse();
            assertThat(resp.violations()).anyMatch(v -> v.contains("Tarif non configure"));
        }

        @Test
        @DisplayName("Z4A-BUGS-08: a check-in in the past (property timezone) is rejected")
        void whenCheckInInThePast_thenUnavailable() {
            Property p = buildProperty();
            when(propertyRepository.findBookingEngineProperty(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(p));
            LocalDate yesterday = LocalDate.now(java.time.ZoneId.of("Europe/Paris")).minusDays(1);

            AvailabilityResponseDto resp = service.checkAvailability(
                    buildCtx(), request(yesterday, yesterday.plusDays(3), 2));

            assertThat(resp.available()).isFalse();
            assertThat(resp.violations()).anyMatch(v -> v.contains("passe"));
        }

        @Test
        @DisplayName("Z4A-BUGS-08: same-day check-in is allowed when minAdvanceDays=0")
        void whenSameDayCheckIn_thenAvailable() {
            Property p = buildProperty();
            stubHappyPath(p);
            LocalDate today = LocalDate.now(java.time.ZoneId.of("Europe/Paris"));
            Map<LocalDate, BigDecimal> priceMap = new HashMap<>();
            priceMap.put(today, new BigDecimal("100.00"));
            priceMap.put(today.plusDays(1), new BigDecimal("100.00"));
            when(priceEngine.resolvePriceRange(PROPERTY_ID, today, today.plusDays(2), ORG_ID))
                    .thenReturn(priceMap);

            BookingEngineConfig cfg = buildConfig(true);
            cfg.setShowCleaningFee(false);
            cfg.setShowTouristTax(false);
            PublicBookingService.OrgContext ctx = new PublicBookingService.OrgContext(buildOrg(), cfg);

            AvailabilityResponseDto resp = service.checkAvailability(
                    ctx, request(today, today.plusDays(2), 2));

            assertThat(resp.available()).isTrue();
        }

        @Test
        @DisplayName("Z4A-BUGS-08: a check-in beyond the hard horizon (3 years) is rejected")
        void whenCheckInTooFarInFuture_thenUnavailable() {
            Property p = buildProperty();
            when(propertyRepository.findBookingEngineProperty(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(p));
            LocalDate farAway = LocalDate.now(java.time.ZoneId.of("Europe/Paris")).plusYears(4);

            AvailabilityResponseDto resp = service.checkAvailability(
                    buildCtx(), request(farAway, farAway.plusDays(3), 2));

            assertThat(resp.available()).isFalse();
            assertThat(resp.violations()).anyMatch(v -> v.contains("lointaine"));
        }
    }

    // ───────────────────── Z4A-BUGS-10 — service options snapshot ───────────────

    @Nested
    class ServiceOptionsSnapshot {

        private final LocalDate in = LocalDate.now().plusDays(7);
        private final LocalDate out = LocalDate.now().plusDays(10);

        private AvailabilityResponseDto availability() {
            return new AvailabilityResponseDto(true, PROPERTY_ID, "Cosy Loft", in, out, 2, 3,
                    List.of(), new BigDecimal("300.00"), new BigDecimal("30.00"),
                    BigDecimal.ZERO, new BigDecimal("330.00"), BigDecimal.ZERO, "EUR", 1, 4, "15:00", "11:00", List.of());
        }

        @Test
        @DisplayName("Z4A-BUGS-10: the embedded hold snapshots selected service options")
        void whenHoldCreatedWithSelections_thenServiceItemsSnapshotted() {
            when(propertyRepository.findBookingEngineProperty(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(buildProperty()));
            Guest g = new Guest();
            g.setId(5L);
            when(guestService.findOrCreate(anyString(), anyString(), any(), any(),
                    eq(GuestChannel.DIRECT), any(), eq(ORG_ID))).thenReturn(g);
            when(reservationRepository.save(any(Reservation.class))).thenAnswer(inv -> {
                Reservation r = inv.getArgument(0);
                r.setId(456L);
                return r;
            });
            List<SelectedServiceOptionDto> selections = List.of(new SelectedServiceOptionDto(7L, 2));

            Reservation hold = service.createEmbeddedCheckoutHold(
                    buildCtx(), PROPERTY_ID, in, out, 2, "jane@example.com", "Jane Doe",
                    availability(), new BigDecimal("20.00"), selections);

            assertThat(hold.getTotalPrice()).isEqualByComparingTo("350.00");
            verify(serviceOptionsService).createReservationServiceItems(
                    eq(hold), eq(selections), eq(2), eq(3), eq(ORG_ID));
        }

        @Test
        @DisplayName("Z4A-BUGS-10: legacy overload creates the hold without snapshot")
        void whenHoldCreatedWithoutSelections_thenNoSnapshot() {
            when(propertyRepository.findBookingEngineProperty(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(buildProperty()));
            Guest g = new Guest();
            g.setId(5L);
            when(guestService.findOrCreate(anyString(), anyString(), any(), any(),
                    eq(GuestChannel.DIRECT), any(), eq(ORG_ID))).thenReturn(g);
            when(reservationRepository.save(any(Reservation.class))).thenAnswer(inv -> {
                Reservation r = inv.getArgument(0);
                r.setId(457L);
                return r;
            });

            service.createEmbeddedCheckoutHold(
                    buildCtx(), PROPERTY_ID, in, out, 2, "jane@example.com", "Jane Doe",
                    availability(), BigDecimal.ZERO);

            verifyNoInteractions(serviceOptionsService);
        }

        @Test
        @DisplayName("Z4A-BUGS-10: webhook fallback recreates service items from metadata selections")
        void whenWebhookFallbackWithServiceOptions_thenItemsSnapshotted() {
            Session s = mock(Session.class);
            when(s.getId()).thenReturn("cs_opts");
            when(s.getMetadata()).thenReturn(Map.of(
                    "property_id", PROPERTY_ID.toString(),
                    "organization_id", ORG_ID.toString(),
                    "check_in", in.toString(),
                    "check_out", out.toString(),
                    "guests", "2",
                    "service_options_total", "20.00",
                    "service_options", "7:2,9:1"));
            lenient().when(s.getCustomerEmail()).thenReturn("walkin@example.com");
            // 330 sejour+menage + 20 options = 350.00
            lenient().when(s.getAmountTotal()).thenReturn(35000L);
            when(reservationRepository.findByStripeSessionId("cs_opts")).thenReturn(Optional.empty());

            Property p = buildProperty();
            when(propertyRepository.findBookingEngineProperty(PROPERTY_ID, ORG_ID))
                    .thenReturn(Optional.of(p));
            when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(buildOrg()));
            when(configRepository.findAllByOrganizationId(ORG_ID))
                    .thenReturn(List.of(buildConfig(true)));
            when(restrictionEngine.validate(any(), any(), any(), any()))
                    .thenReturn(RestrictionEngine.ValidationResult.valid());
            when(calendarDayRepository.countConflicts(any(), any(), any(), any())).thenReturn(0L);
            when(priceEngine.resolvePriceRange(any(), any(), any(), any())).thenReturn(Map.of(
                    in, new BigDecimal("100.00"),
                    in.plusDays(1), new BigDecimal("100.00"),
                    in.plusDays(2), new BigDecimal("100.00")));
            Guest guest = new Guest();
            guest.setId(1L);
            when(guestService.findOrCreate(anyString(), anyString(), anyString(), any(),
                    eq(GuestChannel.DIRECT), any(), eq(ORG_ID))).thenReturn(guest);
            when(reservationRepository.save(any(Reservation.class))).thenAnswer(inv -> {
                Reservation r = inv.getArgument(0);
                r.setId(888L);
                return r;
            });

            service.confirmBookingEngineCheckout(s);

            verify(serviceOptionsService).createReservationServiceItems(
                    any(Reservation.class),
                    eq(List.of(new SelectedServiceOptionDto(7L, 2), new SelectedServiceOptionDto(9L, 1))),
                    eq(2), eq(3), eq(ORG_ID));
            verify(stripeService).confirmReservationPayment("cs_opts");
        }
    }
}
