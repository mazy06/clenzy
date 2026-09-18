package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@DisplayName("PaymentStatusTransitionService")
class PaymentStatusTransitionServiceTest {

    @Mock private EntityManager entityManager;
    @Mock private InterventionRepository interventionRepository;
    @Mock private Query query;

    @Mock private DocumentGenerationOutbox documentOutbox;
    private PaymentStatusTransitionService service;

    @BeforeEach
    void setUp() {
        service = new PaymentStatusTransitionService(entityManager, interventionRepository, documentOutbox);
        lenient().when(entityManager.createQuery(anyString())).thenReturn(query);
        lenient().when(query.setParameter(anyString(), any())).thenReturn(query);
    }

    @Test
    void locksRequestsBeforeMissionsInStableOrder() {
        var request = new com.clenzy.model.ServiceRequest(); request.setId(3L);
        var first = new Intervention(); first.setId(1L); first.setServiceRequest(request);
        var second = new Intervention(); second.setId(2L); second.setServiceRequest(request);
        service.lockInterventionPayments(java.util.List.of(second, first));
        var order = org.mockito.Mockito.inOrder(entityManager);
        order.verify(entityManager).refresh(request, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        order.verify(entityManager).refresh(first, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        order.verify(entityManager).refresh(second, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        order.verifyNoMoreInteractions();
    }

    @Test
    void refusesChangedRequestAfterMissionLock() {
        var mission = new Intervention(); mission.setId(1L);
        var request = new com.clenzy.model.ServiceRequest(); request.setId(3L);
        org.mockito.Mockito.doAnswer(invocation -> { mission.setServiceRequest(request); return null; })
                .when(entityManager).refresh(mission, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        assertThatThrownBy(() -> service.lockInterventionPayments(java.util.List.of(mission)))
                .isInstanceOf(IllegalStateException.class);
    }

    // ─── Transitions gardees vers PAID ──────────────────────────────────────

    @Nested
    @DisplayName("markXxxPaid — UPDATE conditionnel")
    class MarkPaid {

        @Test
        @DisplayName("when row updated, then markInterventionPaid returns true")
        void whenRowUpdated_thenMarkInterventionPaidReturnsTrue() {
            // Arrange
            when(query.executeUpdate()).thenReturn(1);

            // Act & Assert
            assertThat(service.markInterventionPaid(1L)).isTrue();
        }

        @Test
        @DisplayName("when already PAID (0 rows), then markInterventionPaid returns false")
        void whenAlreadyPaid_thenMarkInterventionPaidReturnsFalse() {
            // Arrange
            when(query.executeUpdate()).thenReturn(0);

            // Act & Assert
            assertThat(service.markInterventionPaid(1L)).isFalse();
        }

        @Test
        @DisplayName("update is conditional on current status not PAID")
        void whenMarkPaid_thenQueryGuardsOnStatus() {
            // Arrange
            when(query.executeUpdate()).thenReturn(1);
            ArgumentCaptor<String> jpql = ArgumentCaptor.forClass(String.class);

            // Act
            service.markReservationPaid(5L);

            // Assert
            org.mockito.Mockito.verify(entityManager).createQuery(jpql.capture());
            assertThat(jpql.getValue())
                    .contains("Reservation")
                    .contains("e.paymentStatus <> :paid")
                    .contains("e.paymentStatus <> :refunded");
            verify(query).setParameter("refunded", PaymentStatus.REFUNDED);
        }

        @Test
        @DisplayName("service request transition uses ServiceRequest entity")
        void whenMarkServiceRequestPaid_thenTargetsServiceRequestEntity() {
            // Arrange
            when(query.executeUpdate()).thenReturn(1);
            ArgumentCaptor<String> jpql = ArgumentCaptor.forClass(String.class);

            // Act
            service.markServiceRequestPaid(9L);

            // Assert
            org.mockito.Mockito.verify(entityManager).createQuery(jpql.capture());
            assertThat(jpql.getValue()).contains("ServiceRequest");
        }
    }

    // ─── Contexte de remboursement ───────────────────────────────────────────

    @Nested
    @DisplayName("loadRefundableIntervention")
    class LoadRefundable {

        private Intervention paidIntervention() {
            Intervention i = new Intervention();
            i.setId(1L);
            i.setTitle("Menage");
            i.setPaymentStatus(PaymentStatus.PAID);
            i.setStripeSessionId("cs_1");
            Property p = new Property();
            User owner = new User();
            owner.setKeycloakId("kc-1");
            owner.setEmail("o@x.com");
            p.setOwner(owner);
            i.setProperty(p);
            return i;
        }

        @Test
        @DisplayName("when not found, then throws IllegalArgumentException")
        void whenNotFound_thenThrows() {
            when(interventionRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.loadRefundableIntervention(99L))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("when not PAID, then refuses refund")
        void whenNotPaid_thenThrows() {
            Intervention i = paidIntervention();
            i.setPaymentStatus(PaymentStatus.PROCESSING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(i));

            assertThatThrownBy(() -> service.loadRefundableIntervention(1L))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("confirmes peuvent etre rembourses");
        }

        @Test
        @DisplayName("when no Stripe session, then refuses refund")
        void whenNoStripeSession_thenThrows() {
            Intervention i = paidIntervention();
            i.setStripeSessionId("  ");
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(i));

            assertThatThrownBy(() -> service.loadRefundableIntervention(1L))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Aucune session Stripe");
        }

        @Test
        @DisplayName("happy path extracts scalars including owner info")
        void whenRefundable_thenReturnsContext() {
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(paidIntervention()));

            var ctx = service.loadRefundableIntervention(1L);

            assertThat(ctx.interventionId()).isEqualTo(1L);
            assertThat(ctx.stripeSessionId()).isEqualTo("cs_1");
            assertThat(ctx.title()).isEqualTo("Menage");
            assertThat(ctx.ownerKeycloakId()).isEqualTo("kc-1");
            assertThat(ctx.ownerEmail()).isEqualTo("o@x.com");
        }

        @Test
        @DisplayName("intervention without property -> context without owner info")
        void whenNoProperty_thenOwnerFieldsNull() {
            Intervention i = paidIntervention();
            i.setProperty(null);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(i));

            var ctx = service.loadRefundableIntervention(1L);

            assertThat(ctx.ownerKeycloakId()).isNull();
            assertThat(ctx.ownerEmail()).isNull();
        }
    }

    // ─── Persistance du remboursement ────────────────────────────────────────

    @Test
    void refusesFullRefundOfSessionSharedWithAnotherMission() {
        var mission = new Intervention(); mission.setId(1L);
        mission.setPaymentStatus(PaymentStatus.PAID); mission.setStripeSessionId("shared");
        when(interventionRepository.findById(1L)).thenReturn(Optional.of(mission));
        when(interventionRepository.existsByStripeSessionIdAndIdNot("shared", 1L)).thenReturn(true);
        assertThatThrownBy(() -> service.loadRefundableIntervention(1L))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("plusieurs missions");
    }

    @Nested
    @DisplayName("markInterventionRefunded")
    class MarkRefunded {

        @Test
        void alreadyRefundedDoesNotScheduleAnotherReceipt() {
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(new Intervention()));
            when(query.executeUpdate()).thenReturn(0);
            service.markInterventionRefunded(1L);
            org.mockito.Mockito.verifyNoInteractions(documentOutbox);
        }

        @Test
        void receiptFailurePropagatesToRefundTransaction() {
            var intervention = new Intervention();
            intervention.setOrganizationId(3L);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(query.executeUpdate()).thenReturn(1);
            org.mockito.Mockito.doThrow(new IllegalStateException("outbox failed")).when(documentOutbox)
                    .requestRefundReceipt(1L, 3L, null);
            assertThatThrownBy(() -> service.markInterventionRefunded(1L))
                    .hasMessage("outbox failed");
        }

        @Test
        @DisplayName("when row updated, then completes")
        void whenRowUpdated_thenOk() {
            var intervention = new Intervention(); intervention.setOrganizationId(3L);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(query.executeUpdate()).thenReturn(1);

            service.markInterventionRefunded(1L);
            verify(documentOutbox).requestRefundReceipt(1L, 3L, null);
        }

        @Test
        @DisplayName("when no row updated, then throws for reconciliation")
        void whenNoRowUpdated_thenThrows() {
            when(interventionRepository.findById(1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.markInterventionRefunded(1L))
                    .isInstanceOf(IllegalStateException.class);
        }
    }
}
