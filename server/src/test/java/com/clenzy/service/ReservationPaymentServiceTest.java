package com.clenzy.service;

import com.clenzy.model.Guest;
import com.clenzy.model.MessageChannelType;
import com.clenzy.model.MessageTemplate;
import com.clenzy.model.MessageTemplateType;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.MessageTemplateRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.messaging.GuestMessagingService;
import com.clenzy.tenant.TenantContext;
import com.stripe.model.checkout.Session;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Tests de ReservationPaymentService (logique deplacee de ReservationController,
 * T-ARCH-01) : envoi du lien de paiement + verification Stripe via StripeGateway.
 */
@ExtendWith(MockitoExtension.class)
class ReservationPaymentServiceTest {

    @Mock private ReservationRepository reservationRepository;
    @Mock private StripeService stripeService;
    @Mock private StripeGateway stripeGateway;
    @Mock private EmailService emailService;
    @Mock private GuestMessagingService guestMessagingService;
    @Mock private MessageTemplateRepository messageTemplateRepository;

    private TenantContext tenantContext;
    private ReservationPaymentService service;

    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);

        service = new ReservationPaymentService(reservationRepository, stripeService,
                stripeGateway, emailService, guestMessagingService,
                messageTemplateRepository, tenantContext);
    }

    private Reservation buildReservation() {
        Property property = new Property();
        property.setId(1L);
        property.setName("Apt A");

        Reservation r = new Reservation();
        r.setId(10L);
        r.setOrganizationId(ORG_ID);
        r.setProperty(property);
        r.setGuestName("Jean");
        r.setTotalPrice(new BigDecimal("150.00"));
        r.setCheckIn(LocalDate.of(2026, 3, 1));
        r.setCheckOut(LocalDate.of(2026, 3, 4));
        r.setCurrency("EUR");
        return r;
    }

    private Session buildSession(String id, String url) {
        Session session = mock(Session.class);
        when(session.getId()).thenReturn(id);
        when(session.getUrl()).thenReturn(url);
        return session;
    }

    @Nested
    @DisplayName("sendPaymentLink")
    class SendPaymentLink {

        @Test
        void whenNoEmailAndNoGuestEmail_thenThrowsIllegalArgument() {
            Reservation r = buildReservation();

            assertThatThrownBy(() -> service.sendPaymentLink(r, null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Aucune adresse email");
            verifyNoInteractions(stripeService);
        }

        @Test
        void whenAmountZero_thenThrowsIllegalArgument() {
            Reservation r = buildReservation();
            r.setTotalPrice(BigDecimal.ZERO);

            assertThatThrownBy(() -> service.sendPaymentLink(r, "x@y.z"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("superieur a 0");
            verifyNoInteractions(stripeService);
        }

        @Test
        void whenNoEmailProvided_thenFallsBackToGuestEmail() throws Exception {
            Reservation r = buildReservation();
            Guest guest = new Guest();
            guest.setEmail("guest@mail.com");
            r.setGuest(guest);

            Session session = buildSession("sess_1", "https://stripe.test/pay");
            when(stripeService.createReservationCheckoutSession(
                    eq(10L), eq(new BigDecimal("150.00")), eq("guest@mail.com"), eq("Jean"), eq("Apt A")))
                    .thenReturn(session);
            when(messageTemplateRepository.findByOrganizationIdAndTypeAndIsActiveTrue(
                    ORG_ID, MessageTemplateType.PAYMENT_LINK)).thenReturn(List.of());
            when(reservationRepository.findByIdFetchAll(10L)).thenReturn(Optional.of(r));

            service.sendPaymentLink(r, null);

            verify(emailService).sendSimpleHtmlEmail(eq("guest@mail.com"), anyString(), anyString());
            assertThat(r.getPaymentLinkEmail()).isEqualTo("guest@mail.com");
        }

        @Test
        void whenTemplateConfigured_thenSendsViaMessagingChannel() throws Exception {
            Reservation r = buildReservation();
            Session session = buildSession("sess_2", "https://stripe.test/pay2");
            when(stripeService.createReservationCheckoutSession(
                    any(), any(), anyString(), any(), any())).thenReturn(session);
            MessageTemplate template = new MessageTemplate();
            when(messageTemplateRepository.findByOrganizationIdAndTypeAndIsActiveTrue(
                    ORG_ID, MessageTemplateType.PAYMENT_LINK)).thenReturn(List.of(template));
            when(reservationRepository.findByIdFetchAll(10L)).thenReturn(Optional.of(r));

            service.sendPaymentLink(r, "to@mail.com");

            @SuppressWarnings("unchecked")
            ArgumentCaptor<Map<String, String>> varsCaptor = ArgumentCaptor.forClass(Map.class);
            verify(guestMessagingService).sendForReservationViaChannel(
                    eq(r), eq(template), eq(ORG_ID), eq(MessageChannelType.EMAIL), varsCaptor.capture());
            assertThat(varsCaptor.getValue().get("paymentLink")).contains("https://stripe.test/pay2");
            assertThat(varsCaptor.getValue().get("paymentAmount")).isEqualTo("150.00");
            verify(emailService, never()).sendSimpleHtmlEmail(anyString(), anyString(), anyString());
        }

        @Test
        void whenSent_thenTracksSessionAndPersists() throws Exception {
            Reservation r = buildReservation();
            Session session = buildSession("sess_3", "https://stripe.test/pay3");
            when(stripeService.createReservationCheckoutSession(
                    any(), any(), anyString(), any(), any())).thenReturn(session);
            when(messageTemplateRepository.findByOrganizationIdAndTypeAndIsActiveTrue(
                    ORG_ID, MessageTemplateType.PAYMENT_LINK)).thenReturn(List.of());
            Reservation reloaded = buildReservation();
            when(reservationRepository.findByIdFetchAll(10L)).thenReturn(Optional.of(reloaded));

            Reservation result = service.sendPaymentLink(r, "to@mail.com");

            assertThat(r.getStripeSessionId()).isEqualTo("sess_3");
            assertThat(r.getPaymentLinkEmail()).isEqualTo("to@mail.com");
            assertThat(r.getPaymentLinkSentAt()).isNotNull();
            verify(reservationRepository).save(r);
            assertThat(result).isSameAs(reloaded);
        }

        @Test
        void whenStripeFails_thenWrapsInRuntimeException() throws Exception {
            Reservation r = buildReservation();
            when(stripeService.createReservationCheckoutSession(
                    any(), any(), anyString(), any(), any()))
                    .thenThrow(new RuntimeException("stripe down"));

            assertThatThrownBy(() -> service.sendPaymentLink(r, "to@mail.com"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Erreur lors de l'envoi du lien de paiement");
            verify(reservationRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("checkPaymentStatus")
    class CheckPaymentStatus {

        @Test
        void whenAlreadyPaid_thenReturnsPaidWithoutCallingStripe() throws Exception {
            Reservation r = buildReservation();
            r.setPaymentStatus(PaymentStatus.PAID);

            Map<String, String> result = service.checkPaymentStatus(r);

            assertThat(result).containsEntry("paymentStatus", "PAID")
                    .containsEntry("message", "Paiement deja confirme");
            verifyNoInteractions(stripeGateway);
        }

        @Test
        void whenNoStripeSession_thenReturnsNoSession() throws Exception {
            Reservation r = buildReservation();
            r.setPaymentStatus(PaymentStatus.PROCESSING);
            r.setStripeSessionId("  ");

            Map<String, String> result = service.checkPaymentStatus(r);

            assertThat(result).containsEntry("paymentStatus", "NO_SESSION");
            verifyNoInteractions(stripeGateway);
        }

        @Test
        void whenStripeSaysPaid_thenConfirmsPaymentAndReturnsPaid() throws Exception {
            Reservation r = buildReservation();
            r.setPaymentStatus(PaymentStatus.PROCESSING);
            r.setStripeSessionId("sess_9");

            Session stripeSession = mock(Session.class);
            when(stripeSession.getPaymentStatus()).thenReturn("paid");
            when(stripeGateway.retrieveSession("sess_9")).thenReturn(stripeSession);
            when(reservationRepository.findByIdFetchAll(10L)).thenReturn(Optional.of(r));

            Map<String, String> result = service.checkPaymentStatus(r);

            assertThat(result).containsEntry("paymentStatus", "PAID")
                    .containsEntry("message", "Paiement confirme (webhook rattrape)");
            verify(stripeService).confirmReservationPayment("sess_9");
        }

        @Test
        void whenStripeSaysUnpaid_thenReturnsUppercasedStatus() throws Exception {
            Reservation r = buildReservation();
            r.setPaymentStatus(PaymentStatus.PROCESSING);
            r.setStripeSessionId("sess_9");

            Session stripeSession = mock(Session.class);
            when(stripeSession.getPaymentStatus()).thenReturn("unpaid");
            when(stripeGateway.retrieveSession("sess_9")).thenReturn(stripeSession);

            Map<String, String> result = service.checkPaymentStatus(r);

            assertThat(result).containsEntry("paymentStatus", "UNPAID");
            verify(stripeService, never()).confirmReservationPayment(anyString());
        }

        @Test
        void whenStripeStatusNull_thenReturnsUnknown() throws Exception {
            Reservation r = buildReservation();
            r.setPaymentStatus(PaymentStatus.PROCESSING);
            r.setStripeSessionId("sess_9");

            Session stripeSession = mock(Session.class);
            when(stripeSession.getPaymentStatus()).thenReturn(null);
            when(stripeGateway.retrieveSession("sess_9")).thenReturn(stripeSession);

            Map<String, String> result = service.checkPaymentStatus(r);

            assertThat(result).containsEntry("paymentStatus", "UNKNOWN");
        }
    }
}
