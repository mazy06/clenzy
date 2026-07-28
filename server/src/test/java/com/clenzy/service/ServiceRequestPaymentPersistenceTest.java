package com.clenzy.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.RequestStatus;
import com.clenzy.model.ServiceRequest;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests de ServiceRequestPaymentPersistence : chargement scopé, validations d'éligibilité
 * au paiement et marquage PROCESSING.
 *
 * <p>Ce bean existe pour que ces accès passent par le proxy Spring — c'est lui qui déclenche
 * l'aspect posant les GUC de Row-Level Security (audit RLS, plan REM-T-01). Le fait qu'il
 * soit un bean distinct, appelé depuis {@link ServiceRequestPaymentService}, est donc une
 * contrainte de sécurité et non un choix de style.</p>
 */
@ExtendWith(MockitoExtension.class)
class ServiceRequestPaymentPersistenceTest {

    @Mock private ServiceRequestRepository serviceRequestRepository;
    @Mock private OrganizationAccessGuard organizationAccessGuard;

    @InjectMocks private ServiceRequestPaymentPersistence persistence;

    private ServiceRequest payableSr() {
        ServiceRequest sr = new ServiceRequest();
        sr.setId(5L);
        sr.setOrganizationId(3L);
        sr.setTitle("Fuite robinet");
        sr.setStatus(RequestStatus.AWAITING_PAYMENT);
        sr.setEstimatedCost(new BigDecimal("120.00"));
        return sr;
    }

    @Nested
    @DisplayName("loadPayable")
    class LoadPayable {

        @Test
        void whenPayable_thenReturnsServerSideSnapshot() {
            when(serviceRequestRepository.findById(5L)).thenReturn(Optional.of(payableSr()));

            ServiceRequestPaymentPersistence.PayableServiceRequest payable = persistence.loadPayable(5L);

            assertThat(payable.id()).isEqualTo(5L);
            assertThat(payable.organizationId()).isEqualTo(3L);
            assertThat(payable.title()).isEqualTo("Fuite robinet");
            assertThat(payable.amount()).isEqualByComparingTo("120.00");
        }

        @Test
        void whenNotFound_thenThrowsNotFound() {
            when(serviceRequestRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> persistence.loadPayable(99L))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessageContaining("99");
        }

        @Test
        void whenOtherOrganization_thenGuardDeniesBeforeAnyValidation() {
            when(serviceRequestRepository.findById(5L)).thenReturn(Optional.of(payableSr()));
            doThrow(new AccessDeniedException("Demande hors de votre organisation"))
                    .when(organizationAccessGuard).requireSameOrganization(any(), anyString());

            assertThatThrownBy(() -> persistence.loadPayable(5L))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        void whenNotAwaitingPayment_thenThrows() {
            ServiceRequest sr = payableSr();
            sr.setStatus(RequestStatus.IN_PROGRESS);
            when(serviceRequestRepository.findById(5L)).thenReturn(Optional.of(sr));

            assertThatThrownBy(() -> persistence.loadPayable(5L))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("AWAITING_PAYMENT");
        }

        @Test
        void whenAmountMissing_thenThrows() {
            ServiceRequest sr = payableSr();
            sr.setEstimatedCost(null);
            when(serviceRequestRepository.findById(5L)).thenReturn(Optional.of(sr));

            assertThatThrownBy(() -> persistence.loadPayable(5L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Montant invalide");
        }

        @Test
        void whenAmountNotStrictlyPositive_thenThrows() {
            ServiceRequest sr = payableSr();
            sr.setEstimatedCost(BigDecimal.ZERO);
            when(serviceRequestRepository.findById(5L)).thenReturn(Optional.of(sr));

            assertThatThrownBy(() -> persistence.loadPayable(5L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Montant invalide");
        }
    }

    @Nested
    @DisplayName("loadPaymentState")
    class LoadPaymentState {

        @Test
        void returnsStatusAndSessionReference() {
            ServiceRequest sr = payableSr();
            sr.setPaymentStatus(PaymentStatus.PROCESSING);
            sr.setStripeSessionId("sess_42");
            when(serviceRequestRepository.findById(5L)).thenReturn(Optional.of(sr));

            ServiceRequestPaymentPersistence.ServiceRequestPaymentState state =
                    persistence.loadPaymentState(5L);

            assertThat(state.paymentStatus()).isEqualTo(PaymentStatus.PROCESSING);
            assertThat(state.stripeSessionId()).isEqualTo("sess_42");
        }
    }

    @Nested
    @DisplayName("markProcessing")
    class MarkProcessing {

        @Test
        void persistsProviderReferenceAndProcessingStatus() {
            ServiceRequest sr = payableSr();
            when(serviceRequestRepository.findById(5L)).thenReturn(Optional.of(sr));

            persistence.markProcessing(5L, "cs_sr");

            assertThat(sr.getStripeSessionId()).isEqualTo("cs_sr");
            assertThat(sr.getPaymentStatus()).isEqualTo(PaymentStatus.PROCESSING);
            verify(serviceRequestRepository).save(sr);
        }

        /**
         * Régression audit RLS : l'ancien {@code if (fresh != null)} laissait la demande en
         * AWAITING_PAYMENT sans référence de session, alors que la session existait déjà
         * chez le provider — et sans aucune trace. L'échec doit être explicite.
         */
        @Test
        void whenServiceRequestVanished_thenThrowsInsteadOfSilentNoOp() {
            when(serviceRequestRepository.findById(5L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> persistence.markProcessing(5L, "cs_sr"))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessageContaining("5");
            verify(serviceRequestRepository, never()).save(any());
        }
    }
}
