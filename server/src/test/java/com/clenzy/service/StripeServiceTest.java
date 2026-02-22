package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StripeServiceTest {

    @Mock private InterventionRepository interventionRepository;
    @Mock private NotificationService notificationService;
    @Mock private KafkaTemplate<String, Object> kafkaTemplate;

    private TenantContext tenantContext;
    private StripeService stripeService;
    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        stripeService = new StripeService(interventionRepository, notificationService, kafkaTemplate, tenantContext);
    }

    private Intervention buildIntervention(Long id, InterventionStatus status, PaymentStatus paymentStatus) {
        Intervention intervention = new Intervention();
        intervention.setId(id);
        intervention.setTitle("Test intervention");
        intervention.setStatus(status);
        intervention.setPaymentStatus(paymentStatus);
        return intervention;
    }

    private Intervention buildInterventionWithOwner(Long id, InterventionStatus status, PaymentStatus paymentStatus) {
        Intervention intervention = buildIntervention(id, status, paymentStatus);
        User owner = new User();
        owner.setKeycloakId("kc-owner-1");
        owner.setEmail("owner@test.com");
        Property property = new Property();
        property.setOwner(owner);
        intervention.setProperty(property);
        return intervention;
    }

    // ===== CONFIRM PAYMENT =====

    @Nested
    class ConfirmPayment {

        @Test
        void whenSessionFound_thenSetsPaidAndSaves() {
            Intervention intervention = buildInterventionWithOwner(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            when(interventionRepository.findByStripeSessionId("sess_123", ORG_ID))
                    .thenReturn(Optional.of(intervention));

            stripeService.confirmPayment("sess_123");

            assertThat(intervention.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(intervention.getPaidAt()).isNotNull();
            assertThat(intervention.getStatus()).isEqualTo(InterventionStatus.PENDING);
            verify(interventionRepository).save(intervention);
        }

        @Test
        void whenAwaitingPayment_thenStatusChangesToPending() {
            Intervention intervention = buildIntervention(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            when(interventionRepository.findByStripeSessionId("sess_123", ORG_ID))
                    .thenReturn(Optional.of(intervention));

            stripeService.confirmPayment("sess_123");

            assertThat(intervention.getStatus()).isEqualTo(InterventionStatus.PENDING);
        }

        @Test
        void whenNotAwaitingPayment_thenStatusUnchanged() {
            Intervention intervention = buildIntervention(1L, InterventionStatus.IN_PROGRESS, PaymentStatus.PROCESSING);
            when(interventionRepository.findByStripeSessionId("sess_123", ORG_ID))
                    .thenReturn(Optional.of(intervention));

            stripeService.confirmPayment("sess_123");

            assertThat(intervention.getStatus()).isEqualTo(InterventionStatus.IN_PROGRESS);
        }

        @Test
        void whenSessionNotFound_thenThrows() {
            when(interventionRepository.findByStripeSessionId("unknown", ORG_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> stripeService.confirmPayment("unknown"))
                    .isInstanceOf(RuntimeException.class);
        }

        @Test
        void whenNotificationFails_thenPaymentStillConfirmed() {
            Intervention intervention = buildInterventionWithOwner(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            when(interventionRepository.findByStripeSessionId("sess_123", ORG_ID))
                    .thenReturn(Optional.of(intervention));
            doThrow(new RuntimeException("notification error")).when(notificationService)
                    .notify(any(), any(), any(), any(), any());

            stripeService.confirmPayment("sess_123");

            assertThat(intervention.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            verify(interventionRepository).save(intervention);
        }
    }

    // ===== MARK PAYMENT AS FAILED =====

    @Nested
    class MarkPaymentAsFailed {

        @Test
        void whenInterventionFound_thenStatusIsFailed() {
            Intervention intervention = buildInterventionWithOwner(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            when(interventionRepository.findByStripeSessionId("sess_fail", ORG_ID))
                    .thenReturn(Optional.of(intervention));

            stripeService.markPaymentAsFailed("sess_fail");

            assertThat(intervention.getPaymentStatus()).isEqualTo(PaymentStatus.FAILED);
            verify(interventionRepository).save(intervention);
        }

        @Test
        void whenInterventionNotFound_thenDoesNothing() {
            when(interventionRepository.findByStripeSessionId("unknown", ORG_ID))
                    .thenReturn(Optional.empty());

            stripeService.markPaymentAsFailed("unknown");

            verify(interventionRepository, never()).save(any());
        }
    }

    // ===== CONFIRM GROUPED PAYMENT =====

    @Nested
    class ConfirmGroupedPayment {

        @Test
        void whenMultipleIds_thenAllMarkedAsPaid() {
            Intervention i1 = buildIntervention(1L, InterventionStatus.PENDING, PaymentStatus.PROCESSING);
            Intervention i2 = buildIntervention(2L, InterventionStatus.PENDING, PaymentStatus.PROCESSING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(i1));
            when(interventionRepository.findById(2L)).thenReturn(Optional.of(i2));

            stripeService.confirmGroupedPayment("sess_group", "1,2");

            assertThat(i1.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(i2.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(i1.getStripeSessionId()).isEqualTo("sess_group");
            verify(interventionRepository, times(2)).save(any());
        }

        @Test
        void whenNullIds_thenDoesNothing() {
            stripeService.confirmGroupedPayment("sess", null);
            verify(interventionRepository, never()).save(any());
        }

        @Test
        void whenBlankIds_thenDoesNothing() {
            stripeService.confirmGroupedPayment("sess", "  ");
            verify(interventionRepository, never()).save(any());
        }

        @Test
        void whenInvalidId_thenSkipsIt() {
            Intervention valid = buildIntervention(1L, InterventionStatus.PENDING, PaymentStatus.PROCESSING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(valid));

            stripeService.confirmGroupedPayment("sess", "1,abc,2");

            verify(interventionRepository).save(valid);
        }
    }

    // ===== MARK GROUPED PAYMENT AS FAILED =====

    @Nested
    class MarkGroupedPaymentAsFailed {

        @Test
        void whenMultipleIds_thenAllMarkedFailed() {
            Intervention i1 = buildIntervention(1L, InterventionStatus.PENDING, PaymentStatus.PROCESSING);
            Intervention i2 = buildIntervention(2L, InterventionStatus.PENDING, PaymentStatus.PROCESSING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(i1));
            when(interventionRepository.findById(2L)).thenReturn(Optional.of(i2));

            stripeService.markGroupedPaymentAsFailed("1,2");

            assertThat(i1.getPaymentStatus()).isEqualTo(PaymentStatus.FAILED);
            assertThat(i2.getPaymentStatus()).isEqualTo(PaymentStatus.FAILED);
        }

        @Test
        void whenNullIds_thenDoesNothing() {
            stripeService.markGroupedPaymentAsFailed(null);
            verify(interventionRepository, never()).save(any());
        }
    }

    // ===== REFUND PAYMENT =====

    @Nested
    class RefundPayment {

        @Test
        void whenNotPaid_thenThrows() {
            Intervention intervention = buildIntervention(1L, InterventionStatus.COMPLETED, PaymentStatus.PROCESSING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            assertThatThrownBy(() -> stripeService.refundPayment(1L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("confirmes peuvent etre rembourses");
        }

        @Test
        void whenNoStripeSession_thenThrows() {
            Intervention intervention = buildIntervention(1L, InterventionStatus.COMPLETED, PaymentStatus.PAID);
            intervention.setStripeSessionId(null);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            assertThatThrownBy(() -> stripeService.refundPayment(1L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Aucune session Stripe");
        }

        @Test
        void whenInterventionNotFound_thenThrows() {
            when(interventionRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> stripeService.refundPayment(999L))
                    .isInstanceOf(RuntimeException.class);
        }
    }
}
