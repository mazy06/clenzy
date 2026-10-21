package com.clenzy.service.assignment;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.InterventionAllocationGuard;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.Optional;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class AcceptedServiceRequestConverterTest {
    final InterventionRepository missions=mock(InterventionRepository.class);
    final ReservationRepository reservations=mock(ReservationRepository.class);
    final AcceptedServiceRequestConverter converter=new AcceptedServiceRequestConverter(missions,
        mock(UserRepository.class),reservations,mock(InterventionAllocationGuard.class),Clock.systemUTC());

    @Test void confirmedMissionPreservesOperationalDetailsAndReservationWithoutSecondAcceptance() {
        var need=new ServiceRequest(); need.setId(1L); need.setOrganizationId(2L);
        need.setAssignedToType("team"); need.setAssignedToId(3L); need.setReservationId(4L);
        need.setServiceType(ServiceType.CLEANING); need.setPriority(Priority.NORMAL);
        need.setDesiredDate(LocalDateTime.of(2026,10,1,11,0)); need.setEstimatedDurationHours(2);
        need.setSpecialInstructions("Fragile"); need.setAccessNotes("Accès privé");
        var reservation=new Reservation(); reservation.setOrganizationId(2L);
        when(reservations.findById(4L)).thenReturn(Optional.of(reservation));
        when(missions.saveAndFlush(any())).thenAnswer(call -> { Intervention mission=call.getArgument(0); mission.setId(9L); return mission; });
        var mission=converter.convert(need);
        assertThat(mission.getAssignmentResponse()).isEqualTo(InterventionAssignmentResponse.ACCEPTED);
        assertThat(mission.getSpecialInstructions()).isEqualTo("Fragile");
        assertThat(mission.getAccessNotes()).isEqualTo("Accès privé");
        assertThat(mission.getEndTime()).isEqualTo(need.getDesiredDate().plusHours(2));
        assertThat(reservation.getIntervention()).isSameAs(mission);
        assertThat(need.getConvertedInterventionId()).isEqualTo(9L);
        when(missions.findById(9L)).thenReturn(Optional.of(mission));
        assertThat(converter.convert(need)).isSameAs(mission);
        verify(missions,times(1)).saveAndFlush(any());
    }

    @Test void reservationFromAnotherOrganizationIsRejected() {
        var need=new ServiceRequest(); need.setOrganizationId(2L); need.setReservationId(4L);
        var reservation=new Reservation(); reservation.setOrganizationId(5L);
        when(reservations.findById(4L)).thenReturn(Optional.of(reservation));
        assertThatThrownBy(() -> converter.linkReservation(need,new Intervention()))
            .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThat(reservation.getIntervention()).isNull();
    }

    @Test void propertyLocalSlotBecomesOneUtcInstantInWinterAndSummer() {
        var property=new Property(); property.setTimezone("Europe/Paris");
        when(missions.saveAndFlush(any())).thenAnswer(call -> { Intervention result=call.getArgument(0);result.setId(10L);return result; });
        for (var local : java.util.List.of(LocalDateTime.parse("2026-11-13T10:00"),LocalDateTime.parse("2026-07-13T10:00"))) {
            var need=new ServiceRequest(); need.setId(8L); need.setOrganizationId(2L);
            need.setProperty(property); need.setAssignedToType("team"); need.setAssignedToId(3L);
            need.setServiceItemCode("cleaning-mid-stay"); need.setServiceType(ServiceType.OTHER);
            need.setPriority(Priority.NORMAL); need.setDesiredDate(local); need.setEstimatedDurationHours(2);
            var mission=converter.convert(need);
            var expected=local.atZone(ZoneId.of("Europe/Paris")).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
            assertThat(mission.getScheduledDate()).isEqualTo(expected);
            assertThat(mission.getStartTime()).isEqualTo(expected);
            assertThat(mission.getEndTime()).isEqualTo(expected.plusHours(2));
            assertThat(need.getDesiredDate()).isEqualTo(local);
        }
    }

    @Test void midStayServiceDoesNotReplaceDepartureIntervention() {
        var need=new ServiceRequest(); need.setOrganizationId(2L); need.setReservationId(4L);
        var departure=new Intervention(); departure.setId(40L);
        var reservation=new Reservation(); reservation.setOrganizationId(2L); reservation.setIntervention(departure);
        when(reservations.findById(4L)).thenReturn(Optional.of(reservation));
        for (var code:java.util.List.of("cleaning-mid-stay","culinary-breakfast","driver-airport","driver-station","mobility-parking")) {
            need.setServiceItemCode(code);
            converter.linkReservation(need,new Intervention());
            assertThat(reservation.getIntervention()).isSameAs(departure);
        }
    }
}
