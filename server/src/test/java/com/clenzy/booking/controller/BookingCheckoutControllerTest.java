package com.clenzy.booking.controller;

import com.clenzy.booking.dto.AvailabilityRequestDto;
import com.clenzy.booking.dto.AvailabilityResponseDto;
import com.clenzy.booking.dto.BookingCheckoutRequest;
import com.clenzy.booking.dto.SelectedServiceOptionDto;
import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.service.BookingCheckoutQuoteService;
import com.clenzy.booking.service.BookingServiceOptionsService;
import com.clenzy.booking.service.PublicBookingService;
import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.exception.CalendarConflictException;
import com.clenzy.model.Organization;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.payment.PaymentResult;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.PaymentOrchestrationService;
import com.stripe.exception.ApiException;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingCheckoutControllerTest {

    private static final Long PROPERTY_ID = 1L;
    private static final Long ORG_ID = 1L;
    private static final String CHECK_IN = "2026-06-01";
    private static final String CHECK_OUT = "2026-06-05";

    @Mock private PropertyRepository propertyRepository;
    @Mock private BookingServiceOptionsService serviceOptionsService;
    @Mock private PublicBookingService publicBookingService;
    @Mock private com.clenzy.booking.security.BookingPublicRateLimiter rateLimiter;
    @Mock private com.clenzy.booking.service.BookingPaymentPolicyService paymentPolicyService;
    @Mock private PaymentOrchestrationService orchestrationService;
    @Mock private jakarta.servlet.http.HttpServletRequest httpRequest;

    private BookingCheckoutController controller;

    @BeforeEach
    void setUp() throws Exception {
        // Pattern Vague A : service de devis REEL construit au-dessus des mocks
        // pour conserver la couverture bout-en-bout (stubs/verify inchanges).
        BookingCheckoutQuoteService quoteService = new BookingCheckoutQuoteService(
            propertyRepository, serviceOptionsService, publicBookingService);
        controller = new BookingCheckoutController(quoteService, publicBookingService, rateLimiter,
            paymentPolicyService, orchestrationService);
        setField("stripeSecretKey", "sk_test_xxx");
        setField("currency", "eur");
        org.mockito.Mockito.lenient().when(rateLimiter.tryAcquireHold(any(), anyLong())).thenReturn(true);
        org.mockito.Mockito.lenient().when(paymentPolicyService.resolve(anyLong()))
            .thenReturn(com.clenzy.booking.service.BookingPaymentPolicyService.BookingPaymentPolicy.none());
    }

    /** Résultat d'orchestration embedded réussi (clientSecret + providerTxId). */
    private PaymentOrchestrationResult orchEmbedded(String sessionId, String clientSecret) {
        return new PaymentOrchestrationResult(null,
            PaymentResult.embedded(sessionId, clientSecret), PaymentProviderType.STRIPE);
    }

    private void stubOrchestrator(String sessionId, String clientSecret) {
        when(orchestrationService.initiatePayment(anyLong(), any(), any(PaymentOrchestrationRequest.class)))
            .thenReturn(orchEmbedded(sessionId, clientSecret));
    }

    private void setField(String fieldName, Object value) throws Exception {
        Field f = BookingCheckoutController.class.getDeclaredField(fieldName);
        f.setAccessible(true);
        f.set(controller, value);
    }

    private BookingCheckoutRequest buildRequest(Long propertyId, Long orgId, BigDecimal amount,
                                                  String checkIn, String checkOut, int guests,
                                                  String email, List<SelectedServiceOptionDto> services) {
        return new BookingCheckoutRequest(
            propertyId, orgId, amount, checkIn, checkOut, guests,
            email, "John Doe", services);
    }

    private Property buildProperty() {
        Property property = new Property();
        property.setId(PROPERTY_ID);
        property.setName("Studio Riviera");
        property.setOrganizationId(ORG_ID);
        return property;
    }

    private PublicBookingService.OrgContext buildCtx() {
        Organization org = new Organization();
        org.setId(ORG_ID);
        BookingEngineConfig config = new BookingEngineConfig();
        config.setOrganizationId(ORG_ID);
        config.setEnabled(true);
        return new PublicBookingService.OrgContext(org, config);
    }

    private AvailabilityResponseDto availableQuote(String total) {
        return new AvailabilityResponseDto(true, PROPERTY_ID, "Studio Riviera",
            LocalDate.parse(CHECK_IN), LocalDate.parse(CHECK_OUT), 2, 4,
            List.of(), new BigDecimal(total), BigDecimal.ZERO, BigDecimal.ZERO,
            new BigDecimal(total), BigDecimal.ZERO, "EUR", 1, 4, "15:00", "11:00", List.of());
    }

    private Reservation buildHold(Long id) {
        Reservation hold = new Reservation();
        hold.setId(id);
        hold.setConfirmationCode("RES-HOLD01");
        hold.setOrganizationId(ORG_ID);
        return hold;
    }

    /** Stubs disponibilite + contexte org pour le happy-path du devis serveur. */
    private void stubServerQuote(String serverTotal) {
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(buildProperty()));
        when(publicBookingService.resolveOrgById(ORG_ID)).thenReturn(buildCtx());
        when(publicBookingService.checkAvailability(any(), any(AvailabilityRequestDto.class)))
            .thenReturn(availableQuote(serverTotal));
    }

    @Nested
    @DisplayName("createCheckoutSession")
    class CreateCheckoutSession {

        @Test
        void whenPropertyNotFound_returnsBadRequest() {
            BookingCheckoutRequest request = buildRequest(
                99L, ORG_ID, BigDecimal.TEN, CHECK_IN, CHECK_OUT, 2, "guest@test.com", null);
            when(propertyRepository.findById(99L)).thenReturn(Optional.empty());

            ResponseEntity<?> response = controller.createCheckoutSession(request, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
            assertThat(response.getBody()).isInstanceOf(Map.class);
        }

        @Test
        void whenPropertyOrgMismatch_returnsBadRequest() {
            Property property = buildProperty();
            property.setOrganizationId(2L); // doesn't match request orgId
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));

            BookingCheckoutRequest request = buildRequest(
                PROPERTY_ID, ORG_ID, BigDecimal.TEN, CHECK_IN, CHECK_OUT, 2, "g@test.com", null);

            ResponseEntity<?> response = controller.createCheckoutSession(request, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
            @SuppressWarnings("unchecked")
            Map<String, String> body = (Map<String, String>) response.getBody();
            assertThat(body.get("error")).contains("organisation");
        }

        @Test
        @DisplayName("Z4A-SEC-01: manipulated client amount is rejected with 400, no session created")
        void whenClientAmountManipulated_thenReturns400WithoutSession() {
            stubServerQuote("400.00");
            // L'attaquant annonce 0.01 EUR pour un sejour a 400.00 EUR
            BookingCheckoutRequest request = buildRequest(
                PROPERTY_ID, ORG_ID, new BigDecimal("0.01"), CHECK_IN, CHECK_OUT, 2, "g@test.com", null);

            ResponseEntity<?> response = controller.createCheckoutSession(request, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
            @SuppressWarnings("unchecked")
            Map<String, String> body = (Map<String, String>) response.getBody();
            assertThat(body.get("error")).contains("montant");
            verify(publicBookingService, never()).createEmbeddedCheckoutHold(
                any(), any(), any(), any(), org.mockito.ArgumentMatchers.anyInt(), any(), any(), any(), any(), any());
        }

        @Test
        void whenDatesUnavailable_thenReturns400() {
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(buildProperty()));
            when(publicBookingService.resolveOrgById(ORG_ID)).thenReturn(buildCtx());
            when(publicBookingService.checkAvailability(any(), any(AvailabilityRequestDto.class)))
                .thenReturn(AvailabilityResponseDto.unavailable(PROPERTY_ID,
                    LocalDate.parse(CHECK_IN), LocalDate.parse(CHECK_OUT), 2, List.of("Dates non disponibles")));

            BookingCheckoutRequest request = buildRequest(
                PROPERTY_ID, ORG_ID, new BigDecimal("100.00"), CHECK_IN, CHECK_OUT, 2, "g@test.com", null);

            ResponseEntity<?> response = controller.createCheckoutSession(request, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        @DisplayName("charges the SERVER amount via the orchestrator (embedded), creates the hold and attaches the session")
        void whenOrchestratorSuccess_returns200WithClientSecretAndServerAmount() {
            stubServerQuote("100.00");
            Reservation hold = buildHold(55L);
            when(publicBookingService.createEmbeddedCheckoutHold(
                any(), eq(PROPERTY_ID), any(), any(), eq(2), any(), any(), any(), any(), any()))
                .thenReturn(hold);
            stubOrchestrator("cs_test_abc", "cs_test_abc_secret");

            BookingCheckoutRequest request = buildRequest(
                PROPERTY_ID, ORG_ID, new BigDecimal("100.00"), CHECK_IN, CHECK_OUT, 2, "g@test.com", null);

            ResponseEntity<?> response = controller.createCheckoutSession(request, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body.get("sessionId")).isEqualTo("cs_test_abc");
            assertThat(body.get("clientSecret")).isEqualTo("cs_test_abc_secret");
            assertThat(body.get("reservationCode")).isEqualTo("RES-HOLD01");
            verify(publicBookingService).attachStripeSessionToHold(55L, "cs_test_abc");

            // Le montant facture est le devis serveur (jamais le montant client brut) + flux embedded.
            ArgumentCaptor<PaymentOrchestrationRequest> reqCaptor =
                ArgumentCaptor.forClass(PaymentOrchestrationRequest.class);
            verify(orchestrationService).initiatePayment(eq(ORG_ID), any(), reqCaptor.capture());
            PaymentOrchestrationRequest req = reqCaptor.getValue();
            assertThat(req.amount()).isEqualByComparingTo("100.00");
            assertThat(req.embedded()).isTrue();
            assertThat(req.expiresAtEpochSeconds()).isNotNull();
            assertThat(req.sourceType()).isEqualTo(BookingCheckoutController.SOURCE_TYPE);
            assertThat(req.sourceId()).isEqualTo(55L);
            assertThat(req.metadata()).containsEntry("type", "booking_engine")
                .containsEntry("reservation_id", "55");
        }

        @Test
        @DisplayName("client amount excluding tourist tax is accepted, but the FULL total is charged")
        void whenClientAmountExcludesTouristTax_thenAcceptedAndFullTotalCharged() {
            // subtotal 90 + cleaning 10 + taxe 5 = total 105 ; le widget envoie 100 (hors taxe)
            AvailabilityResponseDto quote = new AvailabilityResponseDto(true, PROPERTY_ID, "Studio Riviera",
                LocalDate.parse(CHECK_IN), LocalDate.parse(CHECK_OUT), 2, 4,
                List.of(), new BigDecimal("90.00"), new BigDecimal("10.00"), new BigDecimal("5.00"),
                new BigDecimal("105.00"), BigDecimal.ZERO, "EUR", 1, 4, "15:00", "11:00", List.of());
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(buildProperty()));
            when(publicBookingService.resolveOrgById(ORG_ID)).thenReturn(buildCtx());
            when(publicBookingService.checkAvailability(any(), any(AvailabilityRequestDto.class)))
                .thenReturn(quote);
            Reservation hold = buildHold(57L);
            when(publicBookingService.createEmbeddedCheckoutHold(
                any(), eq(PROPERTY_ID), any(), any(), eq(2), any(), any(), any(), any(), any()))
                .thenReturn(hold);
            stubOrchestrator("cs_tax", "cs_tax_secret");

            BookingCheckoutRequest request = buildRequest(
                PROPERTY_ID, ORG_ID, new BigDecimal("100.00"), CHECK_IN, CHECK_OUT, 2, "g@test.com", null);

            ResponseEntity<?> response = controller.createCheckoutSession(request, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            ArgumentCaptor<PaymentOrchestrationRequest> reqCaptor =
                ArgumentCaptor.forClass(PaymentOrchestrationRequest.class);
            verify(orchestrationService).initiatePayment(anyLong(), any(), reqCaptor.capture());
            // 105.00 factures (total serveur complet, taxe incluse)
            assertThat(reqCaptor.getValue().amount()).isEqualByComparingTo("105.00");
        }

        @Test
        @DisplayName("Z4A-BUGS-03: calendar conflict on hold creation returns 409")
        void whenHoldConflicts_thenReturns409() {
            stubServerQuote("100.00");
            when(publicBookingService.createEmbeddedCheckoutHold(
                any(), eq(PROPERTY_ID), any(), any(), eq(2), any(), any(), any(), any(), any()))
                .thenThrow(new CalendarConflictException(PROPERTY_ID,
                    LocalDate.parse(CHECK_IN), LocalDate.parse(CHECK_OUT), 2));

            BookingCheckoutRequest request = buildRequest(
                PROPERTY_ID, ORG_ID, new BigDecimal("100.00"), CHECK_IN, CHECK_OUT, 2, "g@test.com", null);

            ResponseEntity<?> response = controller.createCheckoutSession(request, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(409);
        }

        @Test
        @DisplayName("releases the hold and returns 500 when the orchestrator fails")
        void whenOrchestratorFails_thenReleasesHoldAndReturns500() {
            stubServerQuote("100.00");
            Reservation hold = buildHold(55L);
            when(publicBookingService.createEmbeddedCheckoutHold(
                any(), eq(PROPERTY_ID), any(), any(), eq(2), any(), any(), any(), any(), any()))
                .thenReturn(hold);
            when(orchestrationService.initiatePayment(anyLong(), any(), any(PaymentOrchestrationRequest.class)))
                .thenReturn(new PaymentOrchestrationResult(null, PaymentResult.failure("Stripe down"), null));

            BookingCheckoutRequest request = buildRequest(
                PROPERTY_ID, ORG_ID, new BigDecimal("100"), CHECK_IN, CHECK_OUT, 2, "g@test.com", null);

            ResponseEntity<?> response = controller.createCheckoutSession(request, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
            verify(publicBookingService).releaseEmbeddedCheckoutHold(55L);
            verify(publicBookingService, never()).attachStripeSessionToHold(anyLong(), anyString());
        }

        @Test
        @DisplayName("service options are computed server-side and added to the charged amount")
        void whenServiceOptionsProvided_includesServerComputedTotal() {
            stubServerQuote("100.00");
            SelectedServiceOptionDto soDto = mock(SelectedServiceOptionDto.class);
            List<SelectedServiceOptionDto> services = List.of(soDto);
            when(serviceOptionsService.computeServiceOptionsTotal(eq(services), eq(2),
                org.mockito.ArgumentMatchers.anyInt(), eq(ORG_ID)))
                .thenReturn(new BigDecimal("30.00"));
            Reservation hold = buildHold(56L);
            when(publicBookingService.createEmbeddedCheckoutHold(
                any(), eq(PROPERTY_ID), any(), any(), eq(2), any(), any(), any(),
                eq(new BigDecimal("30.00")), eq(services)))
                .thenReturn(hold);
            stubOrchestrator("cs_test_so", "cs_test_so_secret");

            BookingCheckoutRequest request = buildRequest(
                PROPERTY_ID, ORG_ID, new BigDecimal("100.00"), CHECK_IN, CHECK_OUT, 2, "g@test.com", services);

            ResponseEntity<?> response = controller.createCheckoutSession(request, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            ArgumentCaptor<PaymentOrchestrationRequest> reqCaptor =
                ArgumentCaptor.forClass(PaymentOrchestrationRequest.class);
            verify(orchestrationService).initiatePayment(anyLong(), any(), reqCaptor.capture());
            // 100.00 sejour + 30.00 options = 130.00
            assertThat(reqCaptor.getValue().amount()).isEqualByComparingTo("130.00");
            // Z4A-BUGS-10 : selections serialisees en metadata pour le fallback webhook
            assertThat(reqCaptor.getValue().metadata().get("service_options")).isNotNull();
        }

        @Test
        @DisplayName("Z4A-BUGS-07: the session is charged in the PROPERTY currency, not stripe.currency")
        void whenPropertyHasUsdCurrency_thenSessionChargedInUsd() {
            Property usdProperty = buildProperty();
            usdProperty.setDefaultCurrency("USD");
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(usdProperty));
            when(publicBookingService.resolveOrgById(ORG_ID)).thenReturn(buildCtx());
            when(publicBookingService.checkAvailability(any(), any(AvailabilityRequestDto.class)))
                .thenReturn(availableQuote("100.00"));
            Reservation hold = buildHold(58L);
            when(publicBookingService.createEmbeddedCheckoutHold(
                any(), eq(PROPERTY_ID), any(), any(), eq(2), any(), any(), any(), any(), any()))
                .thenReturn(hold);
            stubOrchestrator("cs_usd", "cs_usd_secret");

            BookingCheckoutRequest request = buildRequest(
                PROPERTY_ID, ORG_ID, new BigDecimal("100.00"), CHECK_IN, CHECK_OUT, 2, "g@test.com", null);

            controller.createCheckoutSession(request, httpRequest);

            ArgumentCaptor<PaymentOrchestrationRequest> reqCaptor =
                ArgumentCaptor.forClass(PaymentOrchestrationRequest.class);
            verify(orchestrationService).initiatePayment(anyLong(), any(), reqCaptor.capture());
            assertThat(reqCaptor.getValue().currency()).isEqualTo("USD");
        }

        @Test
        @DisplayName("falls back to stripe.currency when the property has no default currency")
        void whenPropertyCurrencyMissing_thenFallsBackToConfigCurrency() {
            Property noCurrencyProperty = buildProperty();
            noCurrencyProperty.setDefaultCurrency(null); // force le repli sur la devise config
            when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(noCurrencyProperty));
            when(publicBookingService.resolveOrgById(ORG_ID)).thenReturn(buildCtx());
            when(publicBookingService.checkAvailability(any(), any(AvailabilityRequestDto.class)))
                .thenReturn(availableQuote("100.00"));
            Reservation hold = buildHold(59L);
            when(publicBookingService.createEmbeddedCheckoutHold(
                any(), eq(PROPERTY_ID), any(), any(), eq(2), any(), any(), any(), any(), any()))
                .thenReturn(hold);
            stubOrchestrator("cs_eur", "cs_eur_secret");

            BookingCheckoutRequest request = buildRequest(
                PROPERTY_ID, ORG_ID, new BigDecimal("100.00"), CHECK_IN, CHECK_OUT, 2, "g@test.com", null);

            controller.createCheckoutSession(request, httpRequest);

            ArgumentCaptor<PaymentOrchestrationRequest> reqCaptor =
                ArgumentCaptor.forClass(PaymentOrchestrationRequest.class);
            verify(orchestrationService).initiatePayment(anyLong(), any(), reqCaptor.capture());
            assertThat(reqCaptor.getValue().currency()).isEqualTo("eur");
        }

        @Test
        @DisplayName("reliquat A3: rate-limited request returns 429 without quote nor hold")
        void whenRateLimited_thenReturns429WithoutHold() {
            when(rateLimiter.tryAcquireHold(any(), anyLong())).thenReturn(false);

            BookingCheckoutRequest request = buildRequest(
                PROPERTY_ID, ORG_ID, new BigDecimal("100.00"), CHECK_IN, CHECK_OUT, 2, "g@test.com", null);

            ResponseEntity<?> response = controller.createCheckoutSession(request, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(429);
            verify(publicBookingService, never()).createEmbeddedCheckoutHold(
                any(), any(), any(), any(), org.mockito.ArgumentMatchers.anyInt(), any(), any(), any(), any(), any());
            org.mockito.Mockito.verifyNoInteractions(propertyRepository);
        }
    }

    @Nested
    @DisplayName("getSessionStatus")
    class GetSessionStatus {

        @Test
        void whenSuccess_returnsStatusAndPaymentStatus() {
            Session session = mock(Session.class);
            when(session.getStatus()).thenReturn("complete");
            when(session.getPaymentStatus()).thenReturn("paid");

            try (MockedStatic<Session> sessionStatic = mockStatic(Session.class)) {
                sessionStatic.when(() -> Session.retrieve(any(String.class), any(RequestOptions.class)))
                    .thenReturn(session);

                ResponseEntity<?> response = controller.getSessionStatus("cs_test_abc");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                @SuppressWarnings("unchecked")
                Map<String, Object> body = (Map<String, Object>) response.getBody();
                assertThat(body.get("status")).isEqualTo("complete");
                assertThat(body.get("paymentStatus")).isEqualTo("paid");
            }
        }

        @Test
        void whenPaymentStatusNull_returnsUnpaid() {
            Session session = mock(Session.class);
            when(session.getStatus()).thenReturn("open");
            when(session.getPaymentStatus()).thenReturn(null);

            try (MockedStatic<Session> sessionStatic = mockStatic(Session.class)) {
                sessionStatic.when(() -> Session.retrieve(any(String.class), any(RequestOptions.class)))
                    .thenReturn(session);

                ResponseEntity<?> response = controller.getSessionStatus("cs_test_xyz");

                assertThat(response.getStatusCode().value()).isEqualTo(200);
                @SuppressWarnings("unchecked")
                Map<String, Object> body = (Map<String, Object>) response.getBody();
                assertThat(body.get("paymentStatus")).isEqualTo("unpaid");
            }
        }

        @Test
        void whenStripeFails_returns500() {
            try (MockedStatic<Session> sessionStatic = mockStatic(Session.class)) {
                sessionStatic.when(() -> Session.retrieve(any(String.class), any(RequestOptions.class)))
                    .thenThrow(new ApiException("Stripe down", null, "c", 500, null));

                ResponseEntity<?> response = controller.getSessionStatus("cs_test_err");

                assertThat(response.getStatusCode().value()).isEqualTo(500);
            }
        }
    }
}
