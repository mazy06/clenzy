package com.clenzy.booking.service;

import com.clenzy.booking.dto.AvailabilityRequestDto;
import com.clenzy.booking.dto.AvailabilityResponseDto;
import com.clenzy.booking.dto.BookingCheckoutRequestDto;
import com.clenzy.booking.dto.BookingCheckoutResponseDto;
import com.clenzy.booking.dto.BookingReserveRequestDto;
import com.clenzy.booking.dto.BookingReserveResponseDto;
import com.clenzy.booking.dto.PublicPropertyDto;
import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.model.DataSourceMode;
import com.clenzy.booking.repository.BookingEngineConfigRepository;
import com.clenzy.model.Organization;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.GuestService;
import com.clenzy.service.PriceEngine;
import com.clenzy.service.RestrictionEngine;
import com.clenzy.service.StripeService;
import com.clenzy.service.TouristTaxService;
import com.clenzy.service.NotificationService;
import com.clenzy.repository.GuestReviewRepository;
import com.clenzy.service.voucher.VoucherEngine;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Tests de la branche <strong>mode MOCK</strong> de {@link PublicBookingService} (source de données
 * de démonstration Baitly). Même style que {@code PublicBookingServiceTest} : {@code @Mock} des
 * collaborateurs + un VRAI {@link BookingMockDataProvider} injecté.
 *
 * <p>Invariant de sécurité vérifié ici : quand la config est en {@link DataSourceMode#MOCK}, le service
 * sert le jeu de démo et ne touche JAMAIS les collaborateurs à effet réel (repository, Stripe,
 * calendrier, guests).</p>
 */
@ExtendWith(MockitoExtension.class)
class PublicBookingServiceMockModeTest {

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
    private static final Long DEMO_PROPERTY_ID = 9001L;
    private static final YearMonth DEMO_MONTH = YearMonth.of(2030, 1);

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
                new BookingMockDataProvider(),
                org.mockito.Mockito.mock(com.clenzy.service.PaymentOrchestrationService.class),
                org.mockito.Mockito.mock(org.springframework.transaction.PlatformTransactionManager.class));
    }

    // ───────────────────── helpers ──────────────────────────────────────────────

    private Organization buildOrg() {
        Organization o = new Organization();
        o.setId(ORG_ID);
        o.setName("My Org");
        o.setSlug("my-org");
        return o;
    }

    /** Config en mode MOCK (data source de démo) + booking engine activé. */
    private BookingEngineConfig buildMockConfig() {
        BookingEngineConfig c = new BookingEngineConfig();
        c.setId(1L);
        c.setOrganizationId(ORG_ID);
        c.setApiKey("key");
        c.setEnabled(true);
        c.setMinAdvanceDays(0);
        c.setMaxAdvanceDays(365);
        c.setAutoConfirm(false);
        c.setCollectPaymentOnBooking(true);
        c.setShowCleaningFee(true);
        c.setShowTouristTax(true);
        c.setDefaultCurrency("EUR");
        c.setDataSourceMode(DataSourceMode.MOCK);
        return c;
    }

    private PublicBookingService.OrgContext buildMockCtx() {
        return new PublicBookingService.OrgContext(buildOrg(), buildMockConfig());
    }

    // ───────────────────── getProperties (MOCK) ──────────────────────────────────

    @Test
    @DisplayName("whenMockMode_getProperties_servesDemoSetAndTouchesNoRepository")
    void whenMockMode_getProperties_servesDemoSetAndTouchesNoRepository() {
        // Act
        List<PublicPropertyDto> result = service.getProperties(buildMockCtx());

        // Assert : jeu de démo (ids 9001..9006), aucun accès au repo réel.
        assertThat(result).hasSize(6);
        assertThat(result).extracting(PublicPropertyDto::id)
                .containsExactly(9001L, 9002L, 9003L, 9004L, 9005L, 9006L);
        verifyNoInteractions(propertyRepository);
    }

    // ───────────────────── checkAvailability (MOCK) ──────────────────────────────

    @Test
    @DisplayName("whenMockMode_checkAvailability_availableWithoutTouchingRepositories")
    void whenMockMode_checkAvailability_availableWithoutTouchingRepositories() {
        // Arrange : nuits 3/4/5 → aucun jour bloqué (motif jour % 7 == 0).
        LocalDate checkIn = DEMO_MONTH.atDay(3);
        LocalDate checkOut = DEMO_MONTH.atDay(6);
        AvailabilityRequestDto req = new AvailabilityRequestDto(DEMO_PROPERTY_ID, checkIn, checkOut, 2);

        // Act
        AvailabilityResponseDto resp = service.checkAvailability(buildMockCtx(), req);

        // Assert
        assertThat(resp.available()).isTrue();
        assertThat(resp.total()).isGreaterThan(BigDecimal.ZERO);
        verifyNoInteractions(propertyRepository, calendarDayRepository);
    }

    // ───────────────────── reserve (MOCK) — sécurité ─────────────────────────────

    @Test
    @DisplayName("whenMockMode_reserve_hasNoRealSideEffects")
    void whenMockMode_reserve_hasNoRealSideEffects() {
        // Arrange
        LocalDate checkIn = DEMO_MONTH.atDay(3);
        LocalDate checkOut = DEMO_MONTH.atDay(6);
        BookingReserveRequestDto req = new BookingReserveRequestDto(
                DEMO_PROPERTY_ID, checkIn, checkOut, 2,
                new BookingReserveRequestDto.GuestInfo("Jane Démo", "jane@example.com", "+33600000000"),
                "Notes démo",
                null, null);

        // Act
        BookingReserveResponseDto resp = service.reserve(buildMockCtx(), req);

        // Assert : DTO simulé déterministe ET aucun effet réel.
        assertThat(resp).isNotNull();
        assertThat(resp.reservationCode()).isEqualTo("MOCK-9001-" + checkIn);
        assertThat(resp.status()).isEqualTo("PENDING");
        verifyNoInteractions(reservationRepository, stripeService, calendarDayRepository, guestService);
    }

    // ───────────────────── checkout (MOCK) — sécurité ────────────────────────────

    @Test
    @DisplayName("whenMockMode_checkout_neverCallsStripe")
    void whenMockMode_checkout_neverCallsStripe() {
        // Arrange
        BookingCheckoutRequestDto req = new BookingCheckoutRequestDto("MOCK-9001-2030-01-03", null);

        // Act
        BookingCheckoutResponseDto resp = service.checkout(buildMockCtx(), req);

        // Assert : URL/session simulées ET aucun appel Stripe ni persistance.
        assertThat(resp).isNotNull();
        assertThat(resp.checkoutUrl()).isEqualTo("/booking/confirmation?ref=MOCK-9001-2030-01-03&mock=true");
        assertThat(resp.sessionId()).isEqualTo("mock_session_MOCK-9001-2030-01-03");
        assertThat(resp.checkoutUrl()).doesNotContain("stripe");
        verifyNoInteractions(reservationRepository, stripeService);
    }
}
