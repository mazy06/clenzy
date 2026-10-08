package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.model.Reservation;
import com.clenzy.model.ServiceRequest;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.tenant.TenantContext;
import com.clenzy.tenant.TenantScopedExecutor;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.Filter;
import org.hibernate.Session;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StripeWebhookTenantScopeTest {
    @Mock InterventionRepository interventions;
    @Mock ReservationRepository reservations;
    @Mock ServiceRequestRepository requests;
    @Mock EntityManagerFactory factory;
    @Mock EntityManager entityManager;
    @Mock Session session;
    @Mock Filter filter;
    private final TenantContext context = new TenantContext();
    private StripeWebhookTenantScope scope;

    @BeforeEach void setUp() {
        context.clear();
        scope = new StripeWebhookTenantScope(interventions, reservations, requests,
                new TenantScopedExecutor(context, factory));
    }

    @AfterEach void clear() { context.clear(); }

    private void allowScope() {
        when(factory.createEntityManager()).thenReturn(entityManager);
        when(entityManager.unwrap(Session.class)).thenReturn(session);
        when(entityManager.isOpen()).thenReturn(true);
        when(session.enableFilter("organizationFilter")).thenReturn(filter);
    }

    private void assertScopedAction() {
        assertThat(context.getRequiredOrganizationId()).isEqualTo(7L);
        assertThat(context.isSuperAdmin()).isFalse();
        assertThat(context.isSystemOrg()).isFalse();
        assertThat(TransactionSynchronizationManager.hasResource(factory)).isTrue();
        verify(filter).setParameter("orgId", 7L);
    }

    private void assertCleared() {
        assertThat(context.getOrganizationId()).isNull();
        assertThat(TransactionSynchronizationManager.hasResource(factory)).isFalse();
        verify(entityManager).close();
    }

    private Intervention mission(long orgId, String stripeSession) {
        var mission = new Intervention();
        mission.setOrganizationId(orgId);
        mission.setStripeSessionId(stripeSession);
        return mission;
    }

    @Test void anonymousWebhookUsesStoredOrganizationForTheWholeConfirmation() {
        when(interventions.findByStripeSessionId("cs_test_baitly"))
                .thenReturn(Optional.of(mission(7, "cs_test_baitly")));
        allowScope();
        scope.forIntervention("cs_test_baitly", this::assertScopedAction);
        assertCleared();
    }

    @Test void failedConfirmationPropagatesAndCleansTenantForRetry() {
        when(interventions.findByStripeSessionId("cs_test_baitly"))
                .thenReturn(Optional.of(mission(7, "cs_test_baitly")));
        allowScope();
        assertThatThrownBy(() -> scope.forIntervention("cs_test_baitly", () -> {
            assertScopedAction();
            throw new IllegalStateException("ledger unavailable");
        })).isInstanceOf(IllegalStateException.class).hasMessage("ledger unavailable");
        assertCleared();
    }

    @Test void unknownSessionNeverConfirmsOrOpensTenant() {
        when(interventions.findByStripeSessionId("cs_unknown")).thenReturn(Optional.empty());
        Runnable confirmation = mock(Runnable.class);
        assertThatThrownBy(() -> scope.forIntervention("cs_unknown", confirmation))
                .isInstanceOf(com.clenzy.exception.NotFoundException.class);
        verifyNoInteractions(factory, confirmation);
    }

    @Test void reservationUsesItsOwnStoredOrganization() {
        var reservation = new Reservation();
        reservation.setOrganizationId(7L);
        when(reservations.findByStripeSessionId("cs_reservation")).thenReturn(Optional.of(reservation));
        allowScope();
        scope.forReservation("cs_reservation", this::assertScopedAction);
        assertCleared();
    }

    @Test void serviceRequestUsesItsOwnStoredOrganization() {
        var request = new ServiceRequest();
        request.setOrganizationId(7L);
        when(requests.findByStripeSessionId("cs_request")).thenReturn(Optional.of(request));
        allowScope();
        scope.forServiceRequest("cs_request", this::assertScopedAction);
        assertCleared();
    }

    @Test void groupedPaymentUsesOneOrganizationAfterCheckingEverySession() {
        when(interventions.findById(1L)).thenReturn(Optional.of(mission(7, "cs_group")));
        when(interventions.findById(2L)).thenReturn(Optional.of(mission(7, "cs_group")));
        allowScope();
        scope.forGroupedInterventions("cs_group", "1,2", this::assertScopedAction);
        assertCleared();
    }

    @Test void mixedOrganizationsCannotReceiveAnyConfirmation() {
        when(interventions.findById(1L)).thenReturn(Optional.of(mission(7, "cs_group")));
        when(interventions.findById(2L)).thenReturn(Optional.of(mission(8, "cs_group")));
        Runnable confirmation = mock(Runnable.class);
        assertThatThrownBy(() -> scope.forGroupedInterventions("cs_group", "1,2", confirmation))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(factory, confirmation);
    }

    @Test void staleGroupedSessionCannotConfirmAReplacementPayment() {
        when(interventions.findById(1L)).thenReturn(Optional.of(mission(7, "cs_new")));
        Runnable confirmation = mock(Runnable.class);
        assertThatThrownBy(() -> scope.forGroupedInterventions("cs_old", "1", confirmation))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(factory, confirmation);
    }

    @Test void missingOrganizationCannotRunFinancialEffects() {
        var mission = new Intervention();
        when(interventions.findByStripeSessionId("cs_orphan")).thenReturn(Optional.of(mission));
        Runnable confirmation = mock(Runnable.class);
        assertThatThrownBy(() -> scope.forIntervention("cs_orphan", confirmation))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(factory, confirmation);
    }
}
