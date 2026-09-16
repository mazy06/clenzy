package com.clenzy.service.ical;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.*;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ICalReservationCancellerTest {
    @Test void cancellingStayKeepsContractedMissionAndItsLinkedRequest() {
        var reservations = mock(ReservationRepository.class);
        var interventions = mock(InterventionRepository.class);
        var invoices = mock(InvoiceRepository.class);
        var requests = mock(ServiceRequestRepository.class);
        var calendar = mock(CalendarEngine.class);
        var policy = mock(AutomaticInterventionCancellationPolicy.class);
        var property = new Property(); property.setId(3L);
        var reservation = new Reservation(); reservation.setId(4L); reservation.setProperty(property);
        var request = new ServiceRequest(); request.setId(5L); request.setStatus(RequestStatus.PENDING);
        var mission = new Intervention(); mission.setId(6L); mission.setOrganizationId(7L);
        mission.setStatus(InterventionStatus.PENDING); mission.setServiceRequest(request);
        when(interventions.findByReservationId(4L, 7L)).thenReturn(List.of(mission));
        when(requests.findByReservationId(4L, 7L)).thenReturn(List.of(request));
        when(policy.blocker(mission)).thenReturn("AGREEMENT_REQUIRES_REASON");
        var session = new ICalImportSession(null, property, null, 7L, "ical");
        new ICalReservationCanceller(reservations, interventions, invoices, requests, calendar, policy)
                .cancelReservationWithCascade(reservation, session);
        assertThat(mission.getStatus()).isEqualTo(InterventionStatus.PENDING);
        assertThat(request.getStatus()).isEqualTo(RequestStatus.PENDING);
        assertThat(session.errors).singleElement().asString().contains("Mission #6", "gestionnaire");
        verify(interventions, never()).save(any());
        verify(requests, never()).save(any());
        verify(reservations).save(reservation);
    }
}
