package com.clenzy.service.assignment;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.InterventionAllocationGuard;
import com.clenzy.service.PropertyTeamService;
import com.clenzy.service.catalog.ServiceCapabilityPolicy;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ServiceAssignmentServiceTest {
    final ServiceRequestRepository requests=mock(ServiceRequestRepository.class);
    final InterventionRepository interventions=mock(InterventionRepository.class);
    final UserRepository users=mock(UserRepository.class);
    final TeamRepository teams=mock(TeamRepository.class);
    final WorkflowSettingsRepository workflows=mock(WorkflowSettingsRepository.class);
    final ServiceCapabilityPolicy capabilities=mock(ServiceCapabilityPolicy.class);
    final PropertyTeamService propertyTeams=mock(PropertyTeamService.class);
    final JdbcTemplate db=mock(JdbcTemplate.class);
    final AssignmentProposalStore proposals=mock(AssignmentProposalStore.class);
    final AssignmentPolicyStore policies=mock(AssignmentPolicyStore.class);
    final AcceptedServiceRequestConverter converter=mock(AcceptedServiceRequestConverter.class);
    final AssignmentContactPreferences contacts=mock(AssignmentContactPreferences.class);
    final AssignmentCandidateRanking ranking=mock(AssignmentCandidateRanking.class);
    final AssignmentCommercialTerms commercial=mock(AssignmentCommercialTerms.class);
    final InterventionAllocationGuard allocation=mock(InterventionAllocationGuard.class);
    final Instant now=Instant.parse("2026-09-16T10:00:00Z");
    final Jwt jwt=Jwt.withTokenValue("test").header("alg","none").subject("provider").build();
    ServiceAssignmentService service;
    ServiceRequest need;

    @BeforeEach void setup() {
        service=new ServiceAssignmentService(requests,interventions,users,teams,workflows,allocation,
            capabilities,proposals,policies,converter,db,Clock.fixed(now,ZoneOffset.UTC),propertyTeams,commercial,ranking,contacts);
        when(contacts.allowed(any(),any(),any(),anyBoolean(),any())).thenReturn(true);
        when(ranking.rank(any(),any())).thenAnswer(i -> i.getArgument(1));
        need=new ServiceRequest(); need.setId(1L); need.setOrganizationId(2L); need.setAssignmentPhase("PROPOSED");
        need.setAssignmentCycle(1); need.setStatus(RequestStatus.ASSIGNED); need.setServiceItemCode("cleaning-turnover");
        need.setDesiredDate(LocalDateTime.of(2026,9,20,10,0)); need.setEstimatedDurationHours(2);
        need.setAssignedToType("user"); need.setAssignedToId(9L);
        when(requests.findForMutation(1L)).thenReturn(Optional.of(need));
        var user=new User(); user.setId(9L); need.setUser(user);
        when(users.findByKeycloakId("provider")).thenReturn(Optional.of(user));
        when(policies.get(2L)).thenReturn(new AssignmentPolicyStore.Policy(false,false,"UTC",0,24,AssignmentDeadlinePolicy.Settings.defaults()));
    }

    AssignmentProposalStore.Proposal proposal(Instant expires,String state,Long target) {
        var p=new AssignmentProposalStore.Proposal(3L,1L,2L,1,"user",target,"MANUAL",state,now.minusSeconds(60),expires,null,null);
        when(proposals.get(3L)).thenReturn(Optional.of(p));
        return p;
    }

    @Test void expiredResponseCommitsExpirationInsteadOfCreatingAnExecution() {
        var p=proposal(now,"PENDING",9L);
        assertThat(service.respond(1L,3L,true,null,jwt).status()).isEqualTo("EXPIRED");
        verify(proposals).close(p,"EXPIRED",now,null);
        assertThat(need.getAssignedToId()).isNull();
        assertThat(need.getAssignmentPhase()).isEqualTo("MANUAL");
        verifyNoInteractions(converter);
    }

    @Test void anotherProviderCannotRespondEvenToAnExpiredProposal() {
        proposal(now.minusSeconds(1),"PENDING",10L);
        assertThatThrownBy(() -> service.respond(1L,3L,true,null,jwt)).isInstanceOf(AccessDeniedException.class);
        verify(proposals,never()).close(any(),anyString(),any(),any());
        verifyNoInteractions(converter);
    }

    @Test void aChangedNeedVersionCannotBeAccepted() {
        proposal(now.plusSeconds(60),"PENDING",9L); need.setAssignmentCycle(2);
        assertThatThrownBy(() -> service.respond(1L,3L,true,null,jwt)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(converter);
    }

    @Test void changedAvailabilityWithdrawsTheProposalAndReleasesItsProjection() {
        var p=proposal(now.plusSeconds(60),"PENDING",9L);
        when(allocation.isUserDeclaredAvailable(9L,need.getDesiredDate(),2)).thenReturn(false);
        assertThat(service.respond(1L,3L,true,null,jwt).status()).isEqualTo("WITHDRAWN");
        verify(proposals).close(p,"WITHDRAWN",now,"Disponibilité devenue incompatible");
        assertThat(need.getAssignedToId()).isNull();
        verifyNoInteractions(converter);
    }

    @Test void acceptanceCreatesOneConfirmedExecutionAndItsReplayReturnsTheSameId() {
        var p=proposal(now.plusSeconds(60),"PENDING",9L);
        when(allocation.isUserDeclaredAvailable(9L,need.getDesiredDate(),2)).thenReturn(true);
        when(allocation.isRemote("cleaning-turnover")).thenReturn(true);
        when(allocation.assignmentStillQualified(need,"user",9L)).thenReturn(true);
        var terms=new AssignmentCommercialTerms.Terms(new java.math.BigDecimal("80"),"EUR",8L);
        when(commercial.snapshot(3L)).thenReturn(terms);
        when(commercial.resolve(need,"user",9L)).thenReturn(terms);
        when(commercial.same(terms,terms)).thenReturn(true);
        var mission=new Intervention(); mission.setId(44L);
        when(converter.convert(need)).thenAnswer(inv -> {need.setConvertedInterventionId(44L); return mission;});
        assertThat(service.respond(1L,3L,true,null,jwt).interventionId()).isEqualTo(44L);
        verify(proposals).close(p,"ACCEPTED",now,null);
        proposal(now.plusSeconds(60),"ACCEPTED",9L);
        assertThat(service.respond(1L,3L,true,null,jwt).interventionId()).isEqualTo(44L);
        verify(converter,times(1)).convert(need);
    }

    @Test void pendingInternalProposalNeverOpensTheNeedPublicly() {
        assertThat(service.search(1L,2L)).isFalse();
        assertThat(need.getAssignmentPhase()).isEqualTo("PROPOSED");
        verifyNoInteractions(policies);
    }
    @Test void providerCanAcceptTheFrozenEstimateWithoutReplacingItWithTheirPublishedRate() {
        proposal(now.plusSeconds(60),"PENDING",9L);
        when(allocation.isUserDeclaredAvailable(9L,need.getDesiredDate(),2)).thenReturn(true);
        when(allocation.isRemote("cleaning-turnover")).thenReturn(true);
        when(allocation.assignmentStillQualified(need,"user",9L)).thenReturn(true);
        when(commercial.snapshot(3L)).thenReturn(new AssignmentCommercialTerms.Terms(new java.math.BigDecimal("65"),"MAD",null));
        var mission=new Intervention();mission.setId(44L);
        when(converter.convert(need)).thenReturn(mission);
        assertThat(service.respond(1L,3L,true,null,jwt).interventionId()).isEqualTo(44L);
        assertThat(need.getEstimatedCost()).isEqualByComparingTo("65");
        assertThat(mission.getCurrency()).isEqualTo("MAD");
        verify(commercial,never()).resolve(any(),any(),any());
    }

    @Test void foreignOrganizationCannotResumeTheNeed() {
        assertThatThrownBy(() -> service.resume(1L,99L)).isInstanceOf(AccessDeniedException.class);
        assertThat(need.getAssignmentPhase()).isEqualTo("PROPOSED");
    }

    void searching() {
        need.setStatus(RequestStatus.PENDING); need.setAssignmentPhase("INTERNAL"); need.setAssignedToId(null); need.setAssignedToType(null);
        when(policies.get(2L)).thenReturn(new AssignmentPolicyStore.Policy(true,true,"UTC",0,24,AssignmentDeadlinePolicy.Settings.defaults()));
        when(allocation.isRemote(need.getServiceItemCode())).thenReturn(true);
    }

    @Test void exhaustionOpensTheSameNeedPubliclyWithoutCreatingAnExecution() {
        searching();
        assertThat(service.search(1L,2L)).isFalse();
        assertThat(need.getAssignmentPhase()).isEqualTo("PUBLIC");
        verify(proposals).event(1L,null,"PUBLIC","PUBLIC:1:1");
        verifyNoInteractions(converter);
        verify(requests,never()).save(any());
    }

    @Test void databaseFailureNeverBecomesAPublicFallback() {
        searching();
        when(db.queryForList(anyString(),eq(Long.class),any(),any(),any(),any())).thenThrow(new org.springframework.dao.DataAccessResourceFailureException("unavailable"));
        assertThatThrownBy(() -> service.search(1L,2L)).isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThat(need.getAssignmentPhase()).isEqualTo("INTERNAL");
        verify(proposals,never()).event(any(),any(),eq("PUBLIC"),any());
    }

    @Test void exclusionsDoNotSkipAFourthEligibleInternalCandidate() {
        searching();
        when(db.queryForList(anyString(),eq(Long.class),any(),any(),any(),any())).thenReturn(List.of(10L,11L,12L,13L));
        when(proposals.excludedTeams(1L,1)).thenReturn(Set.of(10L,11L,12L));
        when(capabilities.supports("team",13L,need.getServiceItemCode())).thenReturn(true);
        when(propertyTeams.coversNeed(13L,null,need.getServiceItemCode(),2L)).thenReturn(true);
        when(allocation.isTeamDeclaredAvailable(13L,need.getDesiredDate(),2)).thenReturn(true);
        when(policies.snapshot(any())).thenReturn("{}");
        var p=new AssignmentProposalStore.Proposal(7L,1L,2L,1,"team",13L,"AUTOMATIC","PENDING",now,now.plusSeconds(43200),null,null);
        when(proposals.create(eq(1L),eq(2L),eq(1),eq("team"),eq(13L),eq("AUTOMATIC"),eq(now),any(),any())).thenReturn(p);
        assertThat(service.search(1L,2L)).isTrue();
        assertThat(need.getAssignedToId()).isEqualTo(13L);
        assertThat(need.getAssignmentPhase()).isEqualTo("PROPOSED");
        verify(proposals,never()).event(any(),any(),eq("PUBLIC"),any());
    }

    @Test void disabledOrganizationNeverStartsAnAutomaticSearch() {
        need.setStatus(RequestStatus.PENDING); need.setAssignmentPhase("INTERNAL");
        assertThat(service.search(1L,2L)).isFalse();
        assertThat(need.getAssignmentPhase()).isEqualTo("MANUAL");
        assertThat(need.getAutoAssignStatus()).isEqualTo("automation_disabled");
        verifyNoInteractions(db);
    }

    @Test void manualProposalExpirationAlsoResumesAutomaticSearchWhenEnabled() {
        var p=proposal(now,"PENDING",9L);
        when(policies.get(2L)).thenReturn(AssignmentPolicyStore.Policy.defaults());
        when(allocation.isRemote(need.getServiceItemCode())).thenReturn(true);
        assertThat(service.respond(1L,3L,true,null,jwt).status()).isEqualTo("EXPIRED");
        assertThat(need.getAssignmentPhase()).isEqualTo("PUBLIC");
        verify(proposals).close(p,"EXPIRED",now,null);
        verifyNoInteractions(converter);
    }

    @Test void legacyPendingNeedIsInitializedByRecovery() {
        searching();
        need.setAssignmentPhase(null);
        service.tick(1L);
        assertThat(need.getAssignmentPhase()).isEqualTo("PUBLIC");
        verifyNoInteractions(converter);
    }

    @Test void completedNeedCannotReceiveAManualProposal() {
        need.setStatus(RequestStatus.COMPLETED);
        assertThatThrownBy(() -> service.propose(1L,2L,"team",9L)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(policies);
    }

    @Test void unknownTargetTypeIsRejectedBeforeAnyRead() {
        assertThatThrownBy(() -> service.propose(1L,2L,"organization",9L)).isInstanceOf(IllegalArgumentException.class);
        verify(requests,never()).findForMutation(any());
    }

    @Test void internalResourceOutsideContactHoursDefersInsteadOfOpeningPublicly() {
        searching();
        when(db.queryForList(anyString(),eq(Long.class),any(),any(),any(),any())).thenReturn(List.of(13L));
        when(capabilities.supports("team",13L,need.getServiceItemCode())).thenReturn(true);
        when(propertyTeams.coversNeed(13L,null,need.getServiceItemCode(),2L)).thenReturn(true);
        when(allocation.isTeamDeclaredAvailable(13L,need.getDesiredDate(),2)).thenReturn(true);
        when(contacts.allowed(eq("team"),eq(13L),any(),anyBoolean(),any())).thenReturn(false);
        when(contacts.nextAllowed(eq("team"),eq(13L),any(),anyBoolean(),any())).thenReturn(Optional.of(now.plusSeconds(3600)));
        assertThat(service.search(1L,2L)).isFalse();
        assertThat(need.getAssignmentPhase()).isEqualTo("INTERNAL");
        verify(proposals).deferContact(1L,now.plusSeconds(3600));
        verify(proposals,never()).create(any(),any(),anyInt(),any(),any(),any(),any(),any(),any());
    }

    @Test void missingPublicInformationRequiresQualificationRatherThanPublication() {
        searching(); need.setUser(null);
        assertThat(service.search(1L,2L)).isFalse();
        assertThat(need.getAssignmentPhase()).isEqualTo("MANUAL");
    }

    @Test void manualProposalRechecksOccupationUnderTheSameResourceLock() {
        when(policies.get(2L)).thenReturn(new AssignmentPolicyStore.Policy(true,true,"UTC",0,24,AssignmentDeadlinePolicy.Settings.defaults()));
        when(allocation.isRemote(need.getServiceItemCode())).thenReturn(true);
        when(requests.assignmentConflicts(1L,"user",9L,need.getDesiredDate(),2)).thenReturn(true);
        assertThatThrownBy(() -> service.propose(1L,2L,"user",9L))
                .isInstanceOf(com.clenzy.exception.AssignmentConflictException.class);
        verify(requests).lockAssignee("user",9L);
        verify(proposals,never()).create(any(),any(),anyInt(),any(),any(),any(),any(),any(),any());
    }

    @Test void geographyChangesWithdrawTheProposalWithoutCreatingAnExecution() {
        proposal(now.plusSeconds(60),"PENDING",9L);
        when(allocation.isUserDeclaredAvailable(9L,need.getDesiredDate(),2)).thenReturn(true);
        assertThat(service.respond(1L,3L,true,null,jwt).status()).isEqualTo("WITHDRAWN");
        verifyNoInteractions(converter);
    }
}
