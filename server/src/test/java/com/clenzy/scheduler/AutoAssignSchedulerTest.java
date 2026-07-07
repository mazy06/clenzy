package com.clenzy.scheduler;

import com.clenzy.model.ServiceRequest;
import com.clenzy.model.WorkflowSettings;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.WorkflowSettingsRepository;
import com.clenzy.service.ServiceRequestService;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AutoAssignSchedulerTest {

    @Mock private ServiceRequestRepository serviceRequestRepository;
    @Mock private WorkflowSettingsRepository workflowSettingsRepository;
    @Mock private ServiceRequestService serviceRequestService;
    @Mock private SupervisionActivityService supervisionActivityService;

    private AutoAssignScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new AutoAssignScheduler(serviceRequestRepository,
                workflowSettingsRepository, serviceRequestService, supervisionActivityService);
    }

    @Test
    void retry_emptyOrgs_doesNothing() {
        when(serviceRequestRepository.findOrganizationIdsWithPendingUnassigned(anyInt()))
                .thenReturn(List.of());

        scheduler.retryPendingAutoAssignment();

        verifyNoInteractions(serviceRequestService);
        verify(workflowSettingsRepository, never()).findByOrganizationId(anyLong());
    }

    @Test
    void retry_orgWithDisabledAutoAssign_isSkipped() {
        when(serviceRequestRepository.findOrganizationIdsWithPendingUnassigned(anyInt()))
                .thenReturn(List.of(1L));
        WorkflowSettings ws = new WorkflowSettings();
        ws.setAutoAssignInterventions(false);
        when(workflowSettingsRepository.findByOrganizationId(1L)).thenReturn(Optional.of(ws));

        scheduler.retryPendingAutoAssignment();

        verify(serviceRequestRepository, never()).findPendingUnassignedForRetry(anyInt(), anyLong());
        verifyNoInteractions(serviceRequestService);
    }

    @Test
    void retry_orgWithNoWorkflowSettings_proceedsWithAttempt() {
        when(serviceRequestRepository.findOrganizationIdsWithPendingUnassigned(anyInt()))
                .thenReturn(List.of(1L));
        when(workflowSettingsRepository.findByOrganizationId(1L)).thenReturn(Optional.empty());

        ServiceRequest sr = new ServiceRequest();
        sr.setId(100L);
        when(serviceRequestRepository.findPendingUnassignedForRetry(anyInt(), eq(1L)))
                .thenReturn(List.of(sr));
        when(serviceRequestService.attemptAutoAssignByOrgId(sr, 1L)).thenReturn(true);

        scheduler.retryPendingAutoAssignment();

        verify(serviceRequestService).attemptAutoAssignByOrgId(sr, 1L);
    }

    @Test
    void retry_orgWithEnabledAutoAssign_processesAllSRs() {
        when(serviceRequestRepository.findOrganizationIdsWithPendingUnassigned(anyInt()))
                .thenReturn(List.of(1L));
        WorkflowSettings ws = new WorkflowSettings();
        ws.setAutoAssignInterventions(true);
        when(workflowSettingsRepository.findByOrganizationId(1L)).thenReturn(Optional.of(ws));

        ServiceRequest sr1 = new ServiceRequest(); sr1.setId(11L);
        ServiceRequest sr2 = new ServiceRequest(); sr2.setId(22L);
        when(serviceRequestRepository.findPendingUnassignedForRetry(anyInt(), eq(1L)))
                .thenReturn(List.of(sr1, sr2));
        when(serviceRequestService.attemptAutoAssignByOrgId(sr1, 1L)).thenReturn(true);
        when(serviceRequestService.attemptAutoAssignByOrgId(sr2, 1L)).thenReturn(false);

        scheduler.retryPendingAutoAssignment();

        verify(serviceRequestService).attemptAutoAssignByOrgId(sr1, 1L);
        verify(serviceRequestService).attemptAutoAssignByOrgId(sr2, 1L);
    }

    @Test
    void retry_exceptionInsideAttempt_continuesWithOtherSRs() {
        when(serviceRequestRepository.findOrganizationIdsWithPendingUnassigned(anyInt()))
                .thenReturn(List.of(1L));
        when(workflowSettingsRepository.findByOrganizationId(1L)).thenReturn(Optional.empty());

        ServiceRequest sr1 = new ServiceRequest(); sr1.setId(1L);
        ServiceRequest sr2 = new ServiceRequest(); sr2.setId(2L);
        when(serviceRequestRepository.findPendingUnassignedForRetry(anyInt(), eq(1L)))
                .thenReturn(List.of(sr1, sr2));

        when(serviceRequestService.attemptAutoAssignByOrgId(sr1, 1L))
                .thenThrow(new RuntimeException("boom"));
        when(serviceRequestService.attemptAutoAssignByOrgId(sr2, 1L)).thenReturn(true);

        scheduler.retryPendingAutoAssignment();

        verify(serviceRequestService).attemptAutoAssignByOrgId(sr1, 1L);
        verify(serviceRequestService).attemptAutoAssignByOrgId(sr2, 1L);
    }

    @Test
    void retry_exceptionAtOrgLevel_continuesWithOtherOrgs() {
        when(serviceRequestRepository.findOrganizationIdsWithPendingUnassigned(anyInt()))
                .thenReturn(List.of(1L, 2L));
        when(workflowSettingsRepository.findByOrganizationId(1L))
                .thenThrow(new RuntimeException("db error"));
        when(workflowSettingsRepository.findByOrganizationId(2L)).thenReturn(Optional.empty());
        when(serviceRequestRepository.findPendingUnassignedForRetry(anyInt(), eq(2L)))
                .thenReturn(List.of());

        scheduler.retryPendingAutoAssignment();

        verify(workflowSettingsRepository).findByOrganizationId(1L);
        verify(workflowSettingsRepository).findByOrganizationId(2L);
    }

    @Test
    void retry_multipleOrgs_processed() {
        when(serviceRequestRepository.findOrganizationIdsWithPendingUnassigned(anyInt()))
                .thenReturn(List.of(1L, 2L, 3L));
        when(workflowSettingsRepository.findByOrganizationId(anyLong())).thenReturn(Optional.empty());
        when(serviceRequestRepository.findPendingUnassignedForRetry(anyInt(), anyLong()))
                .thenReturn(List.of());

        scheduler.retryPendingAutoAssignment();

        verify(workflowSettingsRepository).findByOrganizationId(1L);
        verify(workflowSettingsRepository).findByOrganizationId(2L);
        verify(workflowSettingsRepository).findByOrganizationId(3L);
    }
}
