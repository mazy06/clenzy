package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
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
    @DisplayName("confirmPayment")
    class ConfirmPayment {

        @Test
        @DisplayName("sets PAID status and saves when session found")
        void whenSessionFound_thenSetsPaidAndSaves() {
            // Arrange
            Intervention intervention = buildInterventionWithOwner(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            when(interventionRepository.findByStripeSessionId("sess_123", ORG_ID))
                    .thenReturn(Optional.of(intervention));

            // Act
            stripeService.confirmPayment("sess_123");

            // Assert
            assertThat(intervention.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(intervention.getPaidAt()).isNotNull();
            assertThat(intervention.getStatus()).isEqualTo(InterventionStatus.PENDING);
            verify(interventionRepository).save(intervention);
        }

        @Test
        @DisplayName("changes AWAITING_PAYMENT to PENDING")
        void whenAwaitingPayment_thenStatusChangesToPending() {
            // Arrange
            Intervention intervention = buildIntervention(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            when(interventionRepository.findByStripeSessionId("sess_123", ORG_ID))
                    .thenReturn(Optional.of(intervention));

            // Act
            stripeService.confirmPayment("sess_123");

            // Assert
            assertThat(intervention.getStatus()).isEqualTo(InterventionStatus.PENDING);
        }

        @Test
        @DisplayName("does not change status when not AWAITING_PAYMENT")
        void whenNotAwaitingPayment_thenStatusUnchanged() {
            // Arrange
            Intervention intervention = buildIntervention(1L, InterventionStatus.IN_PROGRESS, PaymentStatus.PROCESSING);
            when(interventionRepository.findByStripeSessionId("sess_123", ORG_ID))
                    .thenReturn(Optional.of(intervention));

            // Act
            stripeService.confirmPayment("sess_123");

            // Assert
            assertThat(intervention.getStatus()).isEqualTo(InterventionStatus.IN_PROGRESS);
        }

        @Test
        @DisplayName("throws when session not found")
        void whenSessionNotFound_thenThrows() {
            // Arrange
            when(interventionRepository.findByStripeSessionId("unknown", ORG_ID))
                    .thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> stripeService.confirmPayment("unknown"))
                    .isInstanceOf(RuntimeException.class);
        }

        @Test
        @DisplayName("payment still confirmed even when notification fails")
        void whenNotificationFails_thenPaymentStillConfirmed() {
            // Arrange
            Intervention intervention = buildInterventionWithOwner(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            when(interventionRepository.findByStripeSessionId("sess_123", ORG_ID))
                    .thenReturn(Optional.of(intervention));
            doThrow(new RuntimeException("notification error")).when(notificationService)
                    .notify(any(), any(), any(), any(), any());

            // Act
            stripeService.confirmPayment("sess_123");

            // Assert
            assertThat(intervention.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            verify(interventionRepository).save(intervention);
        }

        @Test
        @DisplayName("sends Kafka events for FACTURE and JUSTIFICATIF_PAIEMENT")
        void whenPaymentConfirmed_thenSendsKafkaEvents() {
            // Arrange
            Intervention intervention = buildInterventionWithOwner(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            when(interventionRepository.findByStripeSessionId("sess_123", ORG_ID))
                    .thenReturn(Optional.of(intervention));

            // Act
            stripeService.confirmPayment("sess_123");

            // Assert
            verify(kafkaTemplate, times(2)).send(anyString(), anyString(), any());
        }
    }

    // ===== MARK PAYMENT AS FAILED =====

    @Nested
    @DisplayName("markPaymentAsFailed")
    class MarkPaymentAsFailed {

        @Test
        @DisplayName("sets FAILED status when intervention found")
        void whenInterventionFound_thenStatusIsFailed() {
            // Arrange
            Intervention intervention = buildInterventionWithOwner(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            when(interventionRepository.findByStripeSessionId("sess_fail", ORG_ID))
                    .thenReturn(Optional.of(intervention));

            // Act
            stripeService.markPaymentAsFailed("sess_fail");

            // Assert
            assertThat(intervention.getPaymentStatus()).isEqualTo(PaymentStatus.FAILED);
            verify(interventionRepository).save(intervention);
        }

        @Test
        @DisplayName("does nothing when intervention not found")
        void whenInterventionNotFound_thenDoesNothing() {
            // Arrange
            when(interventionRepository.findByStripeSessionId("unknown", ORG_ID))
                    .thenReturn(Optional.empty());

            // Act
            stripeService.markPaymentAsFailed("unknown");

            // Assert
            verify(interventionRepository, never()).save(any());
        }

        @Test
        @DisplayName("sends notifications to owner and admins")
        void whenFailed_thenNotifiesOwnerAndAdmins() {
            // Arrange
            Intervention intervention = buildInterventionWithOwner(1L, InterventionStatus.AWAITING_PAYMENT, PaymentStatus.PROCESSING);
            when(interventionRepository.findByStripeSessionId("sess_fail", ORG_ID))
                    .thenReturn(Optional.of(intervention));

            // Act
            stripeService.markPaymentAsFailed("sess_fail");

            // Assert
            verify(notificationService).notify(eq("kc-owner-1"), any(), any(), any(), any());
            verify(notificationService).notifyAdminsAndManagers(any(), any(), any(), any());
        }
    }

    // ===== CONFIRM GROUPED PAYMENT =====

    @Nested
    @DisplayName("confirmGroupedPayment")
    class ConfirmGroupedPayment {

        @Test
        @DisplayName("marks all interventions as PAID")
        void whenMultipleIds_thenAllMarkedAsPaid() {
            // Arrange
            Intervention i1 = buildIntervention(1L, InterventionStatus.PENDING, PaymentStatus.PROCESSING);
            Intervention i2 = buildIntervention(2L, InterventionStatus.PENDING, PaymentStatus.PROCESSING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(i1));
            when(interventionRepository.findById(2L)).thenReturn(Optional.of(i2));

            // Act
            stripeService.confirmGroupedPayment("sess_group", "1,2");

            // Assert
            assertThat(i1.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(i2.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(i1.getStripeSessionId()).isEqualTo("sess_group");
            verify(interventionRepository, times(2)).save(any());
        }

        @Test
        @DisplayName("does nothing when ids is null")
        void whenNullIds_thenDoesNothing() {
            // Act
            stripeService.confirmGroupedPayment("sess", null);

            // Assert
            verify(interventionRepository, never()).save(any());
        }

        @Test
        @DisplayName("does nothing when ids is blank")
        void whenBlankIds_thenDoesNothing() {
            // Act
            stripeService.confirmGroupedPayment("sess", "  ");

            // Assert
            verify(interventionRepository, never()).save(any());
        }

        @Test
        @DisplayName("skips invalid (non-numeric) IDs")
        void whenInvalidId_thenSkipsIt() {
            // Arrange
            Intervention valid = buildIntervention(1L, InterventionStatus.PENDING, PaymentStatus.PROCESSING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(valid));

            // Act
            stripeService.confirmGroupedPayment("sess", "1,abc,2");

            // Assert
            verify(interventionRepository).save(valid);
        }

        @Test
        @DisplayName("sets paidAt for each intervention")
        void whenConfirmed_thenSetsPaidAt() {
            // Arrange
            Intervention i1 = buildIntervention(1L, InterventionStatus.PENDING, PaymentStatus.PROCESSING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(i1));

            // Act
            stripeService.confirmGroupedPayment("sess_group", "1");

            // Assert
            assertThat(i1.getPaidAt()).isNotNull();
        }
    }

    // ===== MARK GROUPED PAYMENT AS FAILED =====

    @Nested
    @DisplayName("markGroupedPaymentAsFailed")
    class MarkGroupedPaymentAsFailed {

        @Test
        @DisplayName("marks all interventions as FAILED")
        void whenMultipleIds_thenAllMarkedFailed() {
            // Arrange
            Intervention i1 = buildIntervention(1L, InterventionStatus.PENDING, PaymentStatus.PROCESSING);
            Intervention i2 = buildIntervention(2L, InterventionStatus.PENDING, PaymentStatus.PROCESSING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(i1));
            when(interventionRepository.findById(2L)).thenReturn(Optional.of(i2));

            // Act
            stripeService.markGroupedPaymentAsFailed("1,2");

            // Assert
            assertThat(i1.getPaymentStatus()).isEqualTo(PaymentStatus.FAILED);
            assertThat(i2.getPaymentStatus()).isEqualTo(PaymentStatus.FAILED);
        }

        @Test
        @DisplayName("does nothing when ids is null")
        void whenNullIds_thenDoesNothing() {
            // Act
            stripeService.markGroupedPaymentAsFailed(null);

            // Assert
            verify(interventionRepository, never()).save(any());
        }

        @Test
        @DisplayName("does nothing when ids is blank")
        void whenBlankIds_thenDoesNothing() {
            // Act
            stripeService.markGroupedPaymentAsFailed("  ");

            // Assert
            verify(interventionRepository, never()).save(any());
        }

        @Test
        @DisplayName("skips non-existent interventions")
        void whenInterventionNotFound_thenSkips() {
            // Arrange
            when(interventionRepository.findById(99L)).thenReturn(Optional.empty());

            // Act
            stripeService.markGroupedPaymentAsFailed("99");

            // Assert
            verify(interventionRepository, never()).save(any());
        }
    }

    // ===== REFUND PAYMENT =====

    @Nested
    @DisplayName("refundPayment")
    class RefundPayment {

        @Test
        @DisplayName("throws when payment status is not PAID")
        void whenNotPaid_thenThrows() {
            // Arrange
            Intervention intervention = buildIntervention(1L, InterventionStatus.COMPLETED, PaymentStatus.PROCESSING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            // Act & Assert
            assertThatThrownBy(() -> stripeService.refundPayment(1L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("confirmes peuvent etre rembourses");
        }

        @Test
        @DisplayName("throws when no Stripe session ID")
        void whenNoStripeSession_thenThrows() {
            // Arrange
            Intervention intervention = buildIntervention(1L, InterventionStatus.COMPLETED, PaymentStatus.PAID);
            intervention.setStripeSessionId(null);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            // Act & Assert
            assertThatThrownBy(() -> stripeService.refundPayment(1L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Aucune session Stripe");
        }

        @Test
        @DisplayName("throws when blank Stripe session ID")
        void whenBlankStripeSession_thenThrows() {
            // Arrange
            Intervention intervention = buildIntervention(1L, InterventionStatus.COMPLETED, PaymentStatus.PAID);
            intervention.setStripeSessionId("  ");
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            // Act & Assert
            assertThatThrownBy(() -> stripeService.refundPayment(1L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Aucune session Stripe");
        }

        @Test
        @DisplayName("throws when intervention not found")
        void whenInterventionNotFound_thenThrows() {
            // Arrange
            when(interventionRepository.findById(999L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> stripeService.refundPayment(999L))
                    .isInstanceOf(RuntimeException.class);
        }
    }
}
