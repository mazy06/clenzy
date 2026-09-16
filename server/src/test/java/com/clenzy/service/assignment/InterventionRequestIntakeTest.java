package com.clenzy.service.assignment;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.*;
import com.clenzy.service.catalog.ServiceCatalogReference;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.Test;
import java.time.LocalDateTime;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class InterventionRequestIntakeTest {
    final ServiceRequestRepository requests=mock(ServiceRequestRepository.class);
    final InterventionRepository missions=mock(InterventionRepository.class);
    final ServiceAssignmentService assignments=mock(ServiceAssignmentService.class);
    final ServiceCatalogReference catalog=mock(ServiceCatalogReference.class);
    final InterventionRequestIntake intake=new InterventionRequestIntake(mock(InterventionMapper.class),
            mock(ServiceRequestMapper.class),requests,assignments,new TenantContext(),catalog,missions);
    ServiceRequest previous() {
        var need=new ServiceRequest(); need.setId(1L); need.setOrganizationId(2L); need.setAutoFlowKey("episode");
        when(requests.findByAutoFlowKey("episode",2L)).thenReturn(Optional.of(need));
        when(assignments.lock(1L)).thenReturn(need);
        return need;
    }
    @Test void changingASourceDateKeepsTheSameNeedAndInvalidatesItsProposal() {
        var need=previous(); need.setDesiredDate(LocalDateTime.of(2026,9,17,11,0));
        var date=need.getDesiredDate().plusDays(1);
        assertThat(intake.synchronize("episode",2L,date,false)).isTrue();
        assertThat(need.getDesiredDate()).isEqualTo(date);
        assertThat(need.getAssignmentCycle()).isEqualTo(2);
        verify(assignments).withdraw(1L,2L,"Réservation replanifiée");
        verify(assignments).resume(1L,2L);
        verify(missions,never()).save(any());
    }
    @Test void sourceCancellationClosesTheNeedWithoutCreatingAnExecution() {
        var need=previous();
        assertThat(intake.synchronize("episode",2L,null,true)).isTrue();
        assertThat(need.getStatus()).isEqualTo(RequestStatus.CANCELLED);
        assertThat(need.getAssignmentPhase()).isEqualTo("CANCELLED");
        verify(assignments,never()).resume(any(),any());
        verify(missions,never()).save(any());
    }
    @Test void confirmedAgreementIsNeverChangedByAReservationEvent() {
        var need=previous(); need.setConvertedInterventionId(7L);
        assertThat(intake.synchronize("episode",2L,null,true)).isFalse();
        verify(assignments,never()).withdraw(any(),any(),any());
    }
    @Test void unfinishedRecurringNeedIsNotDuplicated() {
        var need=previous(); var draft=new Intervention(); draft.setOrganizationId(2L);
        assertThat(intake.createRecurringDraft(draft,"episode")).isSameAs(need);
        verify(assignments,never()).initialize(any());
    }
    @Test void completedOccurrenceReleasesTheFlowKeyForTheNextNeed() {
        var need=previous(); need.setStatus(RequestStatus.COMPLETED);
        when(requests.findByAutoFlowKey("episode",2L)).thenReturn(Optional.of(need),Optional.empty());
        var draft=new Intervention(); draft.setOrganizationId(2L); draft.setTitle("Entretien annuel");
        draft.setServiceItemCode("maintenance-general");
        when(catalog.resolve(any(),any(),any(),any())).thenReturn("maintenance-general");
        var next=intake.createRecurringDraft(draft,"episode");
        assertThat(next).isNotSameAs(need); assertThat(need.getAutoFlowKey()).isNull();
        verify(assignments).initialize(next);
        verify(missions,never()).save(any());
    }
}
