package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import java.time.LocalDateTime;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ServiceRequestCancellationCoordinationTest {
    EntityManager em = mock(EntityManager.class);
    InterventionRepository missions = mock(InterventionRepository.class);
    ServiceQuoteRepository quotes = mock(ServiceQuoteRepository.class);
    InterventionPaymentCoordination payments = mock(InterventionPaymentCoordination.class);
    ServiceRequestCancellationCoordination service = new ServiceRequestCancellationCoordination(em, missions, quotes, payments);
    ServiceRequest request;
    Intervention mission;
    @BeforeEach void setup() {
        request = new ServiceRequest(); request.setId(1L); request.setOrganizationId(7L); request.setStatus(RequestStatus.IN_PROGRESS);
        mission = new Intervention(); mission.setId(2L); mission.setOrganizationId(7L); mission.setServiceRequest(request);
        mission.setStatus(InterventionStatus.PENDING);
        when(missions.findIdByServiceRequestId(1L)).thenReturn(2L);
        when(payments.lockMission(7L, 2L)).thenReturn(mission);
    }
    @Test void legacyCancellationCannotBypassAcceptedAgreement() {
        when(quotes.hasApprovedAgreement(2L, 7L)).thenReturn(true);
        assertThatThrownBy(() -> service.requireLegacyCancellationAllowed(request)).hasMessageContaining("depuis le devis");
        assertThat(request.getStatus()).isEqualTo(RequestStatus.IN_PROGRESS);
        assertThat(mission.getStatus()).isEqualTo(InterventionStatus.PENDING);
    }
    @Test void unpaidMissionWithoutAgreementCanBeCoordinated() {
        assertThat(service.requireLegacyCancellationAllowed(request)).isSameAs(mission);
    }
    @Test void paidRequestCannotBeCancelledEvenIfMissionAppearsUnpaid() {
        request.setPaidAt(LocalDateTime.now());
        assertThatThrownBy(() -> service.requireLegacyCancellationAllowed(request)).hasMessageContaining("PAYMENT_REVIEW_REQUIRED");
        verifyNoInteractions(payments);
    }
    @Test void paidMissionCannotBeCancelledThroughRequest() {
        when(payments.cancellationNeedsPaymentReview(mission)).thenReturn(true);
        assertThatThrownBy(() -> service.requireLegacyCancellationAllowed(request)).hasMessageContaining("PAYMENT_REVIEW_REQUIRED");
    }
    @Test void contractualCancellationClosesLinkedRequestAndStopsAssignment() {
        request.setAutoAssignStatus("retrying");
        service.closeLinkedRequest(request, mission, "Remplacement");
        assertThat(request.getStatus()).isEqualTo(RequestStatus.CANCELLED);
        assertThat(request.getAutoAssignStatus()).isNull();
        assertThat(request.getSpecialInstructions()).contains("Remplacement");
    }
    @Test void changedLinkIsRejectedBeforeClosingEitherResource() {
        mission.setServiceRequest(null);
        assertThatThrownBy(() -> service.closeLinkedRequest(request, mission, "Motif")).hasMessageContaining("a changé");
        assertThat(request.getStatus()).isEqualTo(RequestStatus.IN_PROGRESS);
    }
}
