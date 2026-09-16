package com.clenzy.service;

import com.clenzy.dto.ServiceRequestDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.oauth2.jwt.Jwt;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ServiceRequestServiceTest {
    private final InterventionAllocationGuard allocationGuard = org.mockito.Mockito.mock(InterventionAllocationGuard.class);

    @Mock private ServiceRequestRepository serviceRequestRepository;
    @Mock private UserRepository userRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private TeamRepository teamRepository;
    @Mock private NotificationService notificationService;
    @Mock private PropertyTeamService propertyTeamService;
    @Mock private com.clenzy.service.DocumentGenerationOutbox documentOutbox;
    @Mock private ServiceRequestMapper serviceRequestMapper;
    @Mock private AssignmentEventRepository assignmentEventRepository;
    @Mock private WorkflowSettingsRepository workflowSettingsRepository;
    @Mock
    private com.clenzy.service.pricing.CleaningPricingEngine cleaningPricingEngine;
    @Mock private com.clenzy.service.pricing.HousekeeperScoreService housekeeperScoreService;
    @Mock private com.clenzy.service.agent.supervision.SupervisionSuggestionService supervisionSuggestionService;
    @Mock private com.clenzy.service.agent.supervision.SupervisionAutoApplyService supervisionAutoApplyService;
    @Mock private com.clenzy.service.agent.supervision.AutoApplyGate autoApplyGate;
    @Mock private com.clenzy.service.access.OrganizationAccessGuard organizationAccessGuard;

    private TenantContext tenantContext;
    private ServiceRequestService service;

    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        org.mockito.Mockito.lenient().when(allocationGuard.isUserDeclaredAvailable(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any())).thenReturn(true);
        org.mockito.Mockito.lenient().when(allocationGuard.isTeamDeclaredAvailable(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any())).thenReturn(true);
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        lenient().when(serviceRequestRepository.findForMutation(any())).thenAnswer(i -> serviceRequestRepository.findById(i.getArgument(0)));

        service = new ServiceRequestService(
                serviceRequestRepository, userRepository, propertyRepository,
                interventionRepository, reservationRepository, teamRepository, notificationService,
                propertyTeamService, documentOutbox, tenantContext, serviceRequestMapper,
                assignmentEventRepository, workflowSettingsRepository,
                cleaningPricingEngine, housekeeperScoreService,
                supervisionSuggestionService, supervisionAutoApplyService, autoApplyGate,
                organizationAccessGuard, allocationGuard, org.mockito.Mockito.mock(ServiceRequestCancellationCoordination.class));
    }

    // ── Clôture et replanification ───────────────────────────────────────────

    @Test
    void whenServiceWillNeverHappen_thenItIsClosedAndKept() {
        ServiceRequest stuck = buildEntity(41L, "Menage Airbnb", RequestStatus.PENDING);
        stuck.setAutoAssignStatus("exhausted");
        when(serviceRequestRepository.findById(41L)).thenReturn(Optional.of(stuck));
        when(serviceRequestRepository.save(any(ServiceRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        service.cancel(41L, "Le logement a ete vendu");

        ArgumentCaptor<ServiceRequest> saved = ArgumentCaptor.forClass(ServiceRequest.class);
        verify(serviceRequestRepository).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo(RequestStatus.CANCELLED);
        // La recherche d'equipe s'arrete avec elle.
        assertThat(saved.getValue().getAutoAssignStatus()).isNull();
        assertThat(saved.getValue().getSpecialInstructions()).contains("Le logement a ete vendu");
        // Cloturer n'est pas supprimer : la demande reste consultable.
        verify(serviceRequestRepository, never()).deleteById(any());
    }

    @Test
    void whenServiceIsAlreadyCompleted_thenClosingIsRefused() {
        ServiceRequest done = buildEntity(42L, "Menage Airbnb", RequestStatus.COMPLETED);
        when(serviceRequestRepository.findById(42L)).thenReturn(Optional.of(done));

        assertThatThrownBy(() -> service.cancel(42L, null))
                .isInstanceOf(IllegalStateException.class);

        verify(serviceRequestRepository, never()).save(any());
    }

    @Test
    void whenRescheduledWithoutAStay_thenTheNewRequestCarriesNoReservation() {
        // Une remise en etat ne concerne aucun sejour : c'est un choix, pas un oubli.
        ServiceRequest stuck = buildEntity(43L, "Installation climatisation", RequestStatus.PENDING);
        Property property = new Property();
        property.setId(20L);
        stuck.setProperty(property);
        stuck.setEstimatedCost(new java.math.BigDecimal("138"));
        when(serviceRequestRepository.findById(43L)).thenReturn(Optional.of(stuck));
        when(serviceRequestRepository.save(any(ServiceRequest.class))).thenAnswer(inv -> {
            ServiceRequest sr = inv.getArgument(0);
            if (sr.getId() == null) sr.setId(99L);
            lenient().doReturn(Optional.of(sr)).when(serviceRequestRepository).findForMutation(sr.getId());
            return sr;
        });

        LocalDateTime when = LocalDateTime.now().plusDays(5);
        service.reschedule(43L, when, null, null, null, null);

        ArgumentCaptor<ServiceRequest> saved = ArgumentCaptor.forClass(ServiceRequest.class);
        verify(serviceRequestRepository, atLeastOnce()).save(saved.capture());
        ServiceRequest created = saved.getAllValues().get(0);
        assertThat(created.getReservationId()).isNull();
        assertThat(created.getDesiredDate()).isEqualTo(when);
        assertThat(created.getStatus()).isEqualTo(RequestStatus.PENDING);
        // Le coût et le logement suivent la nouvelle demande.
        assertThat(created.getEstimatedCost()).isEqualByComparingTo("138");
        assertThat(created.getProperty()).isSameAs(property);
        // Et l'ancienne est close dans le même geste.
        assertThat(saved.getAllValues()).anyMatch(sr -> sr.getStatus() == RequestStatus.CANCELLED);
    }

    @Test
    void whenRescheduledWithoutADate_thenNothingIsCreated() {
        assertThatThrownBy(() -> service.reschedule(44L, null, null, null, null, null))
                .isInstanceOf(IllegalArgumentException.class);

        verify(serviceRequestRepository, never()).save(any());
    }

    @Test
    void unassignPausesAutomationAndKeepsRequestDetails() {
        ServiceRequest sr = buildEntity(44L, "Original title", RequestStatus.ASSIGNED);
        Property property = new Property();
        property.setId(20L);
        sr.setProperty(property);
        sr.setAssignedToId(99L);
        sr.setAssignedToType("user");
        when(serviceRequestRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        service.unassign(44L);

        assertThat(sr.getAssignedToId()).isNull();
        assertThat(sr.getAssignedToType()).isNull();
        assertThat(sr.getStatus()).isEqualTo(RequestStatus.PENDING);
        assertThat(sr.getAutoAssignStatus()).isEqualTo(ServiceRequestService.MANUAL_ASSIGNMENT_HOLD);
        assertThat(sr.getTitle()).isEqualTo("Original title");
        verify(assignmentEventRepository).save(any());
        assertThat(service.attemptAutoAssign(sr)).isFalse();
        assertThat(service.attemptAutoAssignByOrgId(sr, ORG_ID)).isFalse();
        verifyNoInteractions(propertyTeamService, housekeeperScoreService, workflowSettingsRepository);
    }

    @Test
    void unassignRefusesPaidRequest() {
        ServiceRequest sr = buildEntity(44L, "Paid", RequestStatus.ASSIGNED);
        sr.setPaidAt(LocalDateTime.now());
        assertThatThrownBy(() -> service.unassign(44L)).isInstanceOf(IllegalStateException.class);
        verify(serviceRequestRepository, never()).save(any());
    }

    @Test
    void manualAssignmentReleasesHold() {
        ServiceRequest sr = buildEntity(44L, "Held", RequestStatus.PENDING);
        sr.setAutoAssignStatus(ServiceRequestService.MANUAL_ASSIGNMENT_HOLD);
        when(serviceRequestRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        service.manualAssign(44L, 9L, "team");
        assertThat(sr.getAssignedToId()).isEqualTo(9L);
        assertThat(sr.getAutoAssignStatus()).isEqualTo("found");
        assertThat(sr.getStatus()).isEqualTo(RequestStatus.ASSIGNED);
    }

    @Test
    void unassignIsIdempotent() {
        ServiceRequest sr = buildEntity(44L, "Held", RequestStatus.PENDING);
        sr.setAutoAssignStatus(ServiceRequestService.MANUAL_ASSIGNMENT_HOLD);
        service.unassign(44L);
        verify(serviceRequestRepository, never()).save(any());
        verifyNoInteractions(assignmentEventRepository);
    }

    @Test
    void unassignRefusesExistingMission() {
        ServiceRequest sr = buildEntity(44L, "Assigned", RequestStatus.ASSIGNED);
        sr.setAssignedToId(99L);
        when(interventionRepository.existsByServiceRequestId(44L)).thenReturn(true);
        assertThatThrownBy(() -> service.unassign(44L)).isInstanceOf(IllegalStateException.class);
        assertThat(sr.getAssignedToId()).isEqualTo(99L);
        verify(serviceRequestRepository, never()).save(any());
    }

    @Test
    void unassignRefusesClosedRequest() {
        buildEntity(44L, "Done", RequestStatus.COMPLETED);
        assertThatThrownBy(() -> service.unassign(44L)).isInstanceOf(IllegalStateException.class);
        verify(serviceRequestRepository, never()).save(any());
    }

    @Test
    void unassignChecksOrganizationBeforeChangingAssignment() {
        ServiceRequest sr = buildEntity(44L, "Other organization", RequestStatus.ASSIGNED);
        sr.setOrganizationId(999L);
        doThrow(new org.springframework.security.access.AccessDeniedException("Other organization"))
                .when(organizationAccessGuard).requireSameOrganization(eq(999L), anyString());
        assertThatThrownBy(() -> service.unassign(44L))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verify(serviceRequestRepository, never()).save(any());
    }

    @Test
    void manualAssignRejectsInvalidTargets() {
        assertThatThrownBy(() -> service.manualAssign(44L, null, "user")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.manualAssign(44L, 0L, "team")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.manualAssign(44L, 9L, "none")).isInstanceOf(IllegalArgumentException.class);
        verify(serviceRequestRepository, never()).save(any());
    }

    @Test
    void updateRejectsMissingOrStaleBrowserVersionBeforeMapping() {
        ServiceRequest sr = buildEntity(44L, "Current", RequestStatus.PENDING);
        org.springframework.test.util.ReflectionTestUtils.setField(sr, "version", 3L);
        ServiceRequestDto dto = buildDto();
        assertThatThrownBy(() -> service.update(44L, dto))
                .isInstanceOf(org.springframework.orm.ObjectOptimisticLockingFailureException.class);
        dto.version = null;
        assertThatThrownBy(() -> service.update(44L, dto))
                .isInstanceOf(org.springframework.orm.ObjectOptimisticLockingFailureException.class);
        verifyNoInteractions(serviceRequestMapper);
        verify(serviceRequestRepository, never()).save(any());
    }

    @Test
    void statusCommandDoesNotApplyUnrelatedFields() {
        ServiceRequest sr = buildEntity(44L, "Preserved", RequestStatus.PENDING);
        sr.setAssignedToId(9L);
        sr.setEstimatedCost(new BigDecimal("120.00"));
        when(serviceRequestRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        service.changeStatus(44L, 0L, RequestStatus.REJECTED);
        assertThat(sr.getTitle()).isEqualTo("Preserved");
        assertThat(sr.getAssignedToId()).isEqualTo(9L);
        assertThat(sr.getEstimatedCost()).isEqualByComparingTo("120.00");
        assertThat(sr.getStatus()).isEqualTo(RequestStatus.REJECTED);
        verify(serviceRequestMapper, never()).apply(any(), any());
    }

    @Test
    void statusCommandRefusesStaleDecision() {
        ServiceRequest sr = buildEntity(44L, "Current", RequestStatus.PENDING);
        org.springframework.test.util.ReflectionTestUtils.setField(sr, "version", 1L);
        assertThatThrownBy(() -> service.changeStatus(44L, 0L, RequestStatus.REJECTED))
                .isInstanceOf(org.springframework.orm.ObjectOptimisticLockingFailureException.class);
        assertThat(sr.getStatus()).isEqualTo(RequestStatus.PENDING);
        verify(serviceRequestRepository, never()).save(any());
    }

    @Test
    void quickStatusCannotBypassMissionLifecycle() {
        buildEntity(44L, "Current", RequestStatus.PENDING);
        for (RequestStatus target : List.of(RequestStatus.ASSIGNED, RequestStatus.AWAITING_PAYMENT,
                RequestStatus.IN_PROGRESS, RequestStatus.COMPLETED)) {
            assertThatThrownBy(() -> service.changeStatus(44L, 0L, target))
                    .isInstanceOf(IllegalStateException.class);
        }
        verify(serviceRequestRepository, never()).save(any());
    }

    @Test
    void quickCancellationRefusesLinkedMission() {
        buildEntity(44L, "Current", RequestStatus.ASSIGNED);
        when(interventionRepository.existsByServiceRequestId(44L)).thenReturn(true);
        assertThatThrownBy(() -> service.changeStatus(44L, 0L, RequestStatus.CANCELLED))
                .isInstanceOf(IllegalStateException.class);
        verify(serviceRequestRepository, never()).save(any());
    }

    @Test
    void sameStatusDoesNotRepeatNotifications() {
        buildEntity(44L, "Rejected", RequestStatus.REJECTED);
        service.changeStatus(44L, 0L, RequestStatus.REJECTED);
        verifyNoInteractions(notificationService);
        verify(serviceRequestRepository, never()).save(any());
    }

    @Test
    void formAssignmentUsesManualCommandAndSetsAssignedState() {
        ServiceRequest sr = buildEntity(44L, "Current", RequestStatus.PENDING);
        ServiceRequestDto dto = buildDto();
        dto.assignedToId = 9L;
        dto.assignedToType = "team";
        when(serviceRequestRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        service.update(44L, dto);
        assertThat(sr.getAssignedToId()).isEqualTo(9L);
        assertThat(sr.getStatus()).isEqualTo(RequestStatus.ASSIGNED);
        assertThat(sr.getAutoAssignStatus()).isEqualTo("found");
        verify(assignmentEventRepository).save(any());
    }

    @Test
    void editingLinkedMissionRequiresDedicatedRevision() {
        buildEntity(44L, "Current", RequestStatus.PENDING);
        when(interventionRepository.existsByServiceRequestId(44L)).thenReturn(true);
        assertThatThrownBy(() -> service.update(44L, buildDto())).isInstanceOf(IllegalStateException.class);
        verify(serviceRequestMapper, never()).apply(any(), any());
    }

    @Test
    void cancellationCommandUsesAuditAndFlushesBeforeReturningVersion() {
        ServiceRequest sr = buildEntity(44L, "Current", RequestStatus.PENDING);
        when(serviceRequestRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        service.changeStatus(44L, 0L, RequestStatus.CANCELLED);
        assertThat(sr.getStatus()).isEqualTo(RequestStatus.CANCELLED);
        verify(assignmentEventRepository).save(any());
        verify(serviceRequestRepository).flush();
    }

    @Test
    void manualAssignmentRefusesReservedSlotBeforeChangingTarget() {
        ServiceRequest sr = buildEntity(44L, "Current", RequestStatus.PENDING);
        when(serviceRequestRepository.assignmentConflicts(eq(44L), eq("team"), eq(7L), any(), any()))
                .thenReturn(true);
        assertThatThrownBy(() -> service.manualAssign(44L, 7L, "team")).isInstanceOf(IllegalStateException.class);
        assertThat(sr.getAssignedToId()).isNull();
        verify(serviceRequestRepository, never()).save(any());
        verifyNoInteractions(notificationService, assignmentEventRepository);
    }

    @Test
    void automaticAssignmentDoesNotUseCandidateReservedInTheMeantime() {
        ServiceRequest sr = buildEntity(44L, "Current", RequestStatus.PENDING);
        Property property = new Property(); property.setId(20L); sr.setProperty(property);
        when(propertyTeamService.findAvailableTeamForProperty(eq(20L), any(), any(), anyString()))
                .thenReturn(Optional.of(7L));
        when(serviceRequestRepository.assignmentConflicts(eq(44L), eq("team"), eq(7L), any(), any()))
                .thenReturn(true);
        when(serviceRequestRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        assertThat(service.attemptAutoAssign(sr)).isFalse();
        assertThat(sr.getAssignedToId()).isNull();
        assertThat(sr.getStatus()).isEqualTo(RequestStatus.PENDING);
    }

    @Test
    void automaticAssignmentTriesNextTeamAfterReservationConflict() {
        ServiceRequest sr = buildEntity(44L, "Current", RequestStatus.PENDING);
        Property property = new Property(); property.setId(20L); sr.setProperty(property);
        when(propertyTeamService.findAvailableTeamForProperty(eq(20L), any(), any(), anyString()))
                .thenReturn(Optional.of(7L));
        when(serviceRequestRepository.assignmentConflicts(eq(44L), eq("team"), eq(7L), any(), any()))
                .thenReturn(true);
        when(propertyTeamService.findAvailableTeamForProperty(eq(20L), any(), any(), anyString(), eq(ORG_ID), eq(java.util.Set.of(7L))))
                .thenReturn(Optional.of(8L));
        when(serviceRequestRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        assertThat(service.attemptAutoAssign(sr)).isTrue();
        assertThat(sr.getAssignedToId()).isEqualTo(8L);
        assertThat(sr.getStatus()).isEqualTo(RequestStatus.ASSIGNED);
    }

    @Test
    void manualAssignmentRefusesUnavailableTeamWithoutChangingTheRequest() {
        ServiceRequest sr = buildEntity(44L, "Current", RequestStatus.PENDING);
        when(allocationGuard.isTeamDeclaredAvailable(eq(7L), any(), any())).thenReturn(false);
        assertThatThrownBy(() -> service.manualAssign(44L, 7L, "team"))
                .isInstanceOf(com.clenzy.exception.AssignmentConflictException.class)
                .hasMessageContaining("indisponible");
        assertThat(sr.getAssignedToId()).isNull();
        assertThat(sr.getStatus()).isEqualTo(RequestStatus.PENDING);
        verify(serviceRequestRepository, never()).save(any());
        verifyNoInteractions(notificationService, assignmentEventRepository);
        var order = inOrder(serviceRequestRepository, allocationGuard);
        order.verify(serviceRequestRepository).assignmentConflicts(44L, "team", 7L, sr.getDesiredDate(), null);
        order.verify(allocationGuard).isTeamDeclaredAvailable(7L, sr.getDesiredDate(), null);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(booleans = {false, true})
    void automaticAssignmentTriesNextTeamWhenAvailabilityChanged(boolean explicitOrganization) {
        ServiceRequest sr = buildEntity(44L, "Current", RequestStatus.PENDING);
        Property property = new Property(); property.setId(20L); sr.setProperty(property);
        if (explicitOrganization) {
            when(propertyTeamService.findAvailableTeamForProperty(eq(20L), any(), any(), anyString(), eq(ORG_ID)))
                    .thenReturn(Optional.of(7L));
        } else {
            when(propertyTeamService.findAvailableTeamForProperty(eq(20L), any(), any(), anyString()))
                    .thenReturn(Optional.of(7L));
        }
        when(allocationGuard.isTeamDeclaredAvailable(eq(7L), any(), any())).thenReturn(false);
        when(propertyTeamService.findAvailableTeamForProperty(eq(20L), any(), any(), anyString(), eq(ORG_ID), eq(java.util.Set.of(7L))))
                .thenReturn(Optional.of(8L));
        when(serviceRequestRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        assertThat(explicitOrganization ? service.attemptAutoAssignByOrgId(sr, ORG_ID) : service.attemptAutoAssign(sr)).isTrue();
        assertThat(sr.getAssignedToId()).isEqualTo(8L);
        assertThat(sr.getStatus()).isEqualTo(RequestStatus.ASSIGNED);
        verify(allocationGuard).isTeamDeclaredAvailable(8L, sr.getDesiredDate(), null);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private ServiceRequest buildEntity(Long id, String title, RequestStatus status) {
        ServiceRequest sr = new ServiceRequest();
        sr.setId(id);
        sr.setOrganizationId(ORG_ID);
        lenient().doAnswer(i -> serviceRequestRepository.findById(id).or(() -> Optional.of(sr))).when(serviceRequestRepository).findForMutation(id);
        sr.setTitle(title);
        sr.setStatus(status);
        sr.setPriority(Priority.NORMAL);
        sr.setServiceType(ServiceType.CLEANING);
        sr.setDesiredDate(LocalDateTime.now().plusDays(3));
        return sr;
    }

    private ServiceRequestDto buildDto() {
        ServiceRequestDto dto = new ServiceRequestDto();
        dto.version = 0L;
        dto.title = "Nettoyage appartement";
        dto.serviceType = ServiceType.CLEANING;
        dto.priority = Priority.NORMAL;
        dto.desiredDate = LocalDateTime.now().plusDays(3);
        dto.userId = 10L;
        dto.propertyId = 20L;
        return dto;
    }

    private User buildUser(Long id, UserRole role, String keycloakId) {
        User user = new User();
        user.setId(id);
        user.setRole(role);
        user.setKeycloakId(keycloakId);
        user.setFirstName("Test");
        user.setLastName("User");
        user.setEmail("test@example.com");
        return user;
    }

    private Property buildProperty(Long id, User owner) {
        Property prop = new Property();
        prop.setId(id);
        prop.setName("Appartement Test");
        prop.setOwner(owner);
        return prop;
    }

    // ── Tests ────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("create(dto)")
    class Create {

        @Test void recurringRedeliveryReturnsTheExistingRequestBeforeAnySideEffect() {
            ServiceRequestDto dto = buildDto(); dto.desiredDate = LocalDateTime.of(2026, 10, 1, 9, 0);
            var existing = buildEntity(42L, "Entretien", RequestStatus.CANCELLED);
            String key = "MARKETPLACE_RECURRENCE:9:2026-10-01";
            when(serviceRequestRepository.findByAutoFlowKey(key, ORG_ID)).thenReturn(Optional.of(existing));
            assertThat(service.createRecurringRequest(dto, 9L)).isEqualTo(42L);
            var order = inOrder(serviceRequestRepository);
            order.verify(serviceRequestRepository).acquireAutoFlowKeyLock(key);
            order.verify(serviceRequestRepository).findByAutoFlowKey(key, ORG_ID);
            verifyNoInteractions(notificationService, serviceRequestMapper);
            verify(serviceRequestRepository, never()).save(any());
        }

        @Test
        @DisplayName("maps DTO to entity, saves, notifies admins, returns mapped DTO")
        void whenValidDto_thenMapsAndSavesAndReturnsDto() {
            // Arrange
            ServiceRequestDto inputDto = buildDto();
            ServiceRequest savedEntity = buildEntity(1L, inputDto.title, RequestStatus.PENDING);

            ServiceRequestDto resultDto = new ServiceRequestDto();
            resultDto.id = 1L;
            resultDto.title = "Nettoyage appartement";

            when(serviceRequestRepository.save(any(ServiceRequest.class))).thenReturn(savedEntity);
            when(serviceRequestMapper.toDto(savedEntity)).thenReturn(resultDto);

            // Act
            ServiceRequestDto result = service.create(inputDto);

            // Assert
            assertThat(result.id).isEqualTo(1L);
            assertThat(result.title).isEqualTo("Nettoyage appartement");
            verify(serviceRequestMapper).apply(eq(inputDto), any(ServiceRequest.class));
            verify(serviceRequestRepository).save(any(ServiceRequest.class));
            verify(notificationService).notifyAdminsAndManagers(
                    eq(NotificationKey.SERVICE_REQUEST_CREATED),
                    anyString(), anyString(), anyString(), any(Map.class));
        }

        @Test
        @DisplayName("sets organizationId from TenantContext before saving")
        void whenCreating_thenSetsOrganizationId() {
            // Arrange
            ServiceRequestDto inputDto = buildDto();
            ServiceRequest savedEntity = buildEntity(1L, inputDto.title, RequestStatus.PENDING);
            when(serviceRequestRepository.save(any(ServiceRequest.class))).thenReturn(savedEntity);
            when(serviceRequestMapper.toDto(any())).thenReturn(new ServiceRequestDto());

            // Act
            service.create(inputDto);

            // Assert
            ArgumentCaptor<ServiceRequest> captor = ArgumentCaptor.forClass(ServiceRequest.class);
            verify(serviceRequestRepository).save(captor.capture());
            assertThat(captor.getValue().getOrganizationId()).isEqualTo(ORG_ID);
        }
    }

    @Nested
    @DisplayName("update(id, dto)")
    class Update {

        @Test
        @DisplayName("when found - applies changes, saves, returns mapped DTO")
        void whenFound_thenUpdatesAndReturnsDto() {
            // Arrange
            ServiceRequest existing = buildEntity(1L, "Old Title", RequestStatus.PENDING);
            ServiceRequestDto updateDto = buildDto();
            updateDto.title = "New Title";

            ServiceRequestDto expectedDto = new ServiceRequestDto();
            expectedDto.id = 1L;
            expectedDto.title = "New Title";

            when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(serviceRequestRepository.save(any(ServiceRequest.class))).thenReturn(existing);
            when(serviceRequestMapper.toDto(existing)).thenReturn(expectedDto);

            // Act
            ServiceRequestDto result = service.update(1L, updateDto);

            // Assert
            assertThat(result.title).isEqualTo("New Title");
            verify(serviceRequestMapper).apply(eq(updateDto), eq(existing));
            verify(serviceRequestRepository).save(existing);
        }

        @Test
        @DisplayName("when updated to REJECTED - notifies the requester")
        void whenUpdatedToRejected_thenNotifiesRequester() {
            // Arrange
            User user = buildUser(10L, UserRole.HOST, "kc-user-10");
            ServiceRequest existing = buildEntity(1L, "Menage urgent", RequestStatus.PENDING);
            existing.setUser(user);

            when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(serviceRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(serviceRequestMapper.toDto(any())).thenReturn(new ServiceRequestDto());

            ServiceRequestDto dto = new ServiceRequestDto();
            dto.status = RequestStatus.REJECTED;
            dto.version = 0L;

            doAnswer(inv -> {
                ServiceRequest entity = inv.getArgument(1);
                ServiceRequestDto d = inv.getArgument(0);
                if (d.status != null) entity.setStatus(d.status);
                return null;
            }).when(serviceRequestMapper).apply(any(), any());

            // Act
            service.update(1L, dto);

            // Assert
            verify(notificationService).notify(
                    eq("kc-user-10"),
                    eq(NotificationKey.SERVICE_REQUEST_REJECTED),
                    anyString(), anyString(), anyString(), any());
        }

        @Test
        @DisplayName("when not found - throws NotFoundException")
        void whenNotFound_thenThrowsNotFoundException() {
            // Arrange
            when(serviceRequestRepository.findById(999L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.update(999L, buildDto()))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessageContaining("not found");
        }
    }

    @Nested
    @DisplayName("getById(id)")
    class GetById {

        @Test
        @DisplayName("when found - returns mapped DTO")
        void whenFound_thenReturnsDto() {
            // Arrange
            ServiceRequest entity = buildEntity(1L, "Test SR", RequestStatus.PENDING);
            ServiceRequestDto expectedDto = new ServiceRequestDto();
            expectedDto.id = 1L;
            expectedDto.title = "Test SR";

            when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(entity));
            when(serviceRequestMapper.toDto(entity)).thenReturn(expectedDto);

            // Act
            ServiceRequestDto result = service.getById(1L);

            // Assert
            assertThat(result.id).isEqualTo(1L);
            assertThat(result.title).isEqualTo("Test SR");
        }

        @Test
        @DisplayName("when not found - throws NotFoundException")
        void whenNotFound_thenThrowsNotFoundException() {
            // Arrange
            when(serviceRequestRepository.findById(999L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.getById(999L))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("list()")
    class ListAll {

        @Test
        @DisplayName("returns all service requests mapped to DTOs")
        void whenCalled_thenReturnsMappedList() {
            // Arrange
            ServiceRequest sr1 = buildEntity(1L, "SR 1", RequestStatus.PENDING);
            ServiceRequest sr2 = buildEntity(2L, "SR 2", RequestStatus.ASSIGNED);
            ServiceRequestDto dto1 = new ServiceRequestDto();
            dto1.id = 1L;
            ServiceRequestDto dto2 = new ServiceRequestDto();
            dto2.id = 2L;

            when(serviceRequestRepository.findAllWithRelations(ORG_ID)).thenReturn(List.of(sr1, sr2));
            when(serviceRequestMapper.toDto(sr1)).thenReturn(dto1);
            when(serviceRequestMapper.toDto(sr2)).thenReturn(dto2);

            // Act
            List<ServiceRequestDto> result = service.list();

            // Assert
            assertThat(result).hasSize(2);
            assertThat(result.get(0).id).isEqualTo(1L);
            assertThat(result.get(1).id).isEqualTo(2L);
        }

        @Test
        @DisplayName("returns empty list when no requests exist")
        void whenNoRequests_thenReturnsEmptyList() {
            // Arrange
            when(serviceRequestRepository.findAllWithRelations(ORG_ID)).thenReturn(List.of());

            // Act
            List<ServiceRequestDto> result = service.list();

            // Assert
            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("list(pageable)")
    class ListPaged {

        @Test
        @DisplayName("returns paginated service requests")
        void whenCalled_thenReturnsPaginatedDtos() {
            // Arrange
            Pageable pageable = PageRequest.of(0, 10);
            ServiceRequest sr1 = buildEntity(1L, "SR 1", RequestStatus.PENDING);
            Page<ServiceRequest> page = new PageImpl<>(List.of(sr1), pageable, 1);
            ServiceRequestDto dto1 = new ServiceRequestDto();
            dto1.id = 1L;

            when(serviceRequestRepository.findAll(pageable)).thenReturn(page);
            when(serviceRequestRepository.findAllWithRelations(ORG_ID)).thenReturn(List.of(sr1));
            when(serviceRequestMapper.toDto(sr1)).thenReturn(dto1);

            // Act
            Page<ServiceRequestDto> result = service.list(pageable);

            // Assert
            assertThat(result.getTotalElements()).isEqualTo(1);
            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).id).isEqualTo(1L);
        }
    }

    @Nested
    @DisplayName("search(pageable, userId, propertyId, status, serviceType)")
    class Search {

        @Test
        @DisplayName("filters by all criteria and returns paginated results")
        void whenCriteriaProvided_thenFiltersAndReturnsPaged() {
            // Arrange
            Pageable pageable = PageRequest.of(0, 10);
            User user = buildUser(10L, UserRole.HOST, "kc-10");
            Property property = buildProperty(20L, user);

            ServiceRequest matching = buildEntity(1L, "Matching", RequestStatus.PENDING);
            matching.setUser(user);
            matching.setProperty(property);
            matching.setServiceType(ServiceType.CLEANING);

            ServiceRequest nonMatching = buildEntity(2L, "Other", RequestStatus.ASSIGNED);
            User otherUser = buildUser(99L, UserRole.HOST, "kc-99");
            nonMatching.setUser(otherUser);
            nonMatching.setProperty(property);

            ServiceRequestDto dto1 = new ServiceRequestDto();
            dto1.id = 1L;

            when(serviceRequestRepository.findAllWithRelations(ORG_ID))
                    .thenReturn(List.of(matching, nonMatching));
            when(serviceRequestMapper.toDto(matching)).thenReturn(dto1);

            // Act
            Page<ServiceRequestDto> result = service.search(pageable, 10L, null, RequestStatus.PENDING, null);

            // Assert
            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).id).isEqualTo(1L);
            assertThat(result.getTotalElements()).isEqualTo(1);
        }

        @Test
        @DisplayName("with null filters returns all results")
        void whenNullFilters_thenReturnsAll() {
            // Arrange
            Pageable pageable = PageRequest.of(0, 10);
            ServiceRequest sr = buildEntity(1L, "SR1", RequestStatus.PENDING);
            sr.setUser(buildUser(1L, UserRole.HOST, "kc-1"));
            sr.setProperty(buildProperty(1L, sr.getUser()));
            ServiceRequestDto dto = new ServiceRequestDto();
            dto.id = 1L;

            when(serviceRequestRepository.findAllWithRelations(ORG_ID)).thenReturn(List.of(sr));
            when(serviceRequestMapper.toDto(sr)).thenReturn(dto);

            // Act
            Page<ServiceRequestDto> result = service.search(pageable, null, null, null, null);

            // Assert
            assertThat(result.getContent()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("delete(id)")
    class Delete {

        @Test
        @DisplayName("when exists - deletes by ID")
        void whenExists_thenDeletes() {
            // Arrange
            when(serviceRequestRepository.existsById(1L)).thenReturn(true);

            // Act
            service.delete(1L);

            // Assert
            verify(serviceRequestRepository).deleteById(1L);
        }

        @Test
        @DisplayName("when not found - throws NotFoundException")
        void whenNotFound_thenThrowsNotFoundException() {
            // Arrange
            when(serviceRequestRepository.existsById(999L)).thenReturn(false);

            // Act & Assert
            assertThatThrownBy(() -> service.delete(999L))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    // ── Refuse ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("refuse(serviceRequestId)")
    class Refuse {

        @Test
        @DisplayName("when SR is ASSIGNED - resets assignment, sets PENDING, notifies admins")
        void whenAssigned_thenResetsAndNotifies() {
            ServiceRequest sr = buildEntity(1L, "Menage", RequestStatus.ASSIGNED);
            sr.setAssignedToId(50L);
            sr.setAssignedToType("team");
            sr.setProperty(buildProperty(20L, buildUser(10L, UserRole.HOST, "kc-10")));
            sr.setAutoAssignRetryCount(2);
            sr.setOrganizationId(ORG_ID);

            when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(sr));
            when(serviceRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(serviceRequestMapper.toDto(any())).thenReturn(new ServiceRequestDto());
            // Workflow disabled → attemptAutoAssign returns early without touching retryCount
            WorkflowSettings ws = new WorkflowSettings();
            ws.setAutoAssignInterventions(false);
            when(workflowSettingsRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(ws));

            service.refuse(1L);

            assertThat(sr.getAssignedToId()).isNull();
            assertThat(sr.getAssignedToType()).isNull();
            assertThat(sr.getStatus()).isEqualTo(RequestStatus.PENDING);
            assertThat(sr.getAutoAssignRetryCount()).isEqualTo(0);
            verify(notificationService).notifyAdminsAndManagers(
                    eq(NotificationKey.SERVICE_REQUEST_CREATED),
                    contains("refusee"), anyString(), anyString(), any(Map.class));
            verify(assignmentEventRepository).save(argThat(e ->
                    "REFUSE".equals(((AssignmentEvent) e).getEventType())));
        }

        @Test
        @DisplayName("when reassign fails on a cleaning SR - records a REASSIGN_CLEANING HITL card")
        void whenReassignFailsOnCleaningSr_thenHitlCardRecorded() {
            ServiceRequest sr = buildEntity(1L, "Menage Airbnb", RequestStatus.ASSIGNED);
            sr.setAssignedToId(50L);
            sr.setProperty(buildProperty(20L, buildUser(10L, UserRole.HOST, "kc-10")));
            sr.setOrganizationId(ORG_ID);

            when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(sr));
            when(serviceRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(serviceRequestMapper.toDto(any())).thenReturn(new ServiceRequestDto());
            // Auto-assignation désactivée → attemptAutoAssign échoue → carte HITL
            WorkflowSettings ws = new WorkflowSettings();
            ws.setAutoAssignInterventions(false);
            when(workflowSettingsRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(ws));

            service.refuse(1L);

            verify(supervisionSuggestionService).recordActionable(
                    eq(ORG_ID), eq(20L), eq("ops"),
                    contains("Remplacer le prestataire"), contains("désisté"),
                    eq(com.clenzy.service.agent.supervision.SupervisionActionType.REASSIGN_CLEANING),
                    contains("\"serviceRequestId\":1"), isNull(), eq("warning"));
        }

        @Test
        @DisplayName("when autonomy gate says AUTO - goes through the auto-apply pipeline")
        void whenGateAuto_thenAutoApplyPipelineUsed() {
            ServiceRequest sr = buildEntity(1L, "Menage Airbnb", RequestStatus.ASSIGNED);
            sr.setAssignedToId(50L);
            sr.setProperty(buildProperty(20L, buildUser(10L, UserRole.HOST, "kc-10")));
            sr.setOrganizationId(ORG_ID);

            when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(sr));
            when(serviceRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(serviceRequestMapper.toDto(any())).thenReturn(new ServiceRequestDto());
            WorkflowSettings ws = new WorkflowSettings();
            ws.setAutoAssignInterventions(false);
            when(workflowSettingsRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(ws));
            when(autoApplyGate.decide(eq(ORG_ID), eq("ops"),
                    eq(com.clenzy.service.agent.supervision.SupervisionActionType.REASSIGN_CLEANING), any()))
                    .thenReturn(com.clenzy.service.agent.supervision.AutoApplyGate.AutoDecision.AUTO_NOTIFY);
            when(supervisionSuggestionService.recordActionableForAutoApply(
                    any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                    .thenReturn(Optional.of(9L));

            service.refuse(1L);

            verify(supervisionAutoApplyService).autoApply(
                    eq(com.clenzy.service.agent.supervision.AutoApplyGate.AutoDecision.AUTO_NOTIFY),
                    eq(ORG_ID), eq(20L), eq("ops"), eq(9L), anyString(), anyString(), isNull());
        }

        @Test
        @DisplayName("when SR is AWAITING_PAYMENT - refuses successfully")
        void whenAwaitingPayment_thenRefuses() {
            ServiceRequest sr = buildEntity(1L, "Test", RequestStatus.AWAITING_PAYMENT);
            sr.setAssignedToId(50L);
            sr.setProperty(buildProperty(20L, buildUser(10L, UserRole.HOST, "kc-10")));

            when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(sr));
            when(serviceRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(serviceRequestMapper.toDto(any())).thenReturn(new ServiceRequestDto());

            service.refuse(1L);

            assertThat(sr.getStatus()).isEqualTo(RequestStatus.PENDING);
        }

        @Test
        @DisplayName("when SR is PENDING - throws IllegalStateException")
        void whenPending_thenThrows() {
            ServiceRequest sr = buildEntity(1L, "Pending one", RequestStatus.PENDING);
            when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(sr));

            assertThatThrownBy(() -> service.refuse(1L))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("PENDING");
        }

        @Test
        @DisplayName("when not found - throws NotFoundException")
        void whenNotFound_thenThrows() {
            when(serviceRequestRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.refuse(999L))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("retryAutoAssignForSupervision(orgId, srId)")
    class RetryAutoAssignForSupervision {

        @Test
        @DisplayName("when SR already reassigned meanwhile - succeeds without new attempt (idempotent)")
        void whenAlreadyAssigned_thenIdempotentSuccess() {
            ServiceRequest sr = buildEntity(1L, "Menage", RequestStatus.AWAITING_PAYMENT);
            sr.setAssignedToId(50L);
            sr.setOrganizationId(ORG_ID);
            when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(sr));

            assertThat(service.retryAutoAssignForSupervision(ORG_ID, 1L)).isTrue();
            verify(serviceRequestRepository, never()).save(any());
        }

        @Test
        @DisplayName("when SR belongs to another org - throws AccessDeniedException")
        void whenCrossOrg_thenAccessDenied() {
            ServiceRequest sr = buildEntity(1L, "Menage", RequestStatus.PENDING);
            sr.setOrganizationId(42L);
            when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(sr));

            assertThatThrownBy(() -> service.retryAutoAssignForSupervision(ORG_ID, 1L))
                    .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        }
    }

    // ── ManualAssign ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("manualAssign(srId, assignedToId, type)")
    class ManualAssign {

        @Test
        @DisplayName("when SR PENDING - assigns and switches to ASSIGNED (pas encore payable)")
        void whenPending_thenAssigns() {
            ServiceRequest sr = buildEntity(1L, "T", RequestStatus.PENDING);
            when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(sr));
            when(serviceRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(serviceRequestMapper.toDto(any())).thenReturn(new ServiceRequestDto());

            service.manualAssign(1L, 99L, "user");

            assertThat(sr.getAssignedToId()).isEqualTo(99L);
            assertThat(sr.getAssignedToType()).isEqualTo("user");
            // ASSIGNEE, pas payable : personne n'a encore travaille. Le solde ne
            // devient du qu'apres le controle du travail rendu.
            assertThat(sr.getStatus()).isEqualTo(RequestStatus.ASSIGNED);
            assertThat(sr.getAutoAssignStatus()).isEqualTo("found");
            verify(assignmentEventRepository).save(argThat(e ->
                    "MANUAL_ASSIGN".equals(((AssignmentEvent) e).getEventType())));
        }

        @Test
        @DisplayName("when SR ASSIGNED - allows reassignment")
        void whenAssigned_thenReassigns() {
            ServiceRequest sr = buildEntity(1L, "T", RequestStatus.ASSIGNED);
            when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(sr));
            when(serviceRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(serviceRequestMapper.toDto(any())).thenReturn(new ServiceRequestDto());

            service.manualAssign(1L, 77L, "team");

            assertThat(sr.getAssignedToId()).isEqualTo(77L);
        }

        @Test
        @DisplayName("when SR COMPLETED - throws IllegalStateException")
        void whenCompleted_thenThrows() {
            ServiceRequest sr = buildEntity(1L, "T", RequestStatus.COMPLETED);
            when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(sr));

            assertThatThrownBy(() -> service.manualAssign(1L, 99L, "team"))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        @DisplayName("when not found - throws NotFoundException")
        void whenNotFound_thenThrows() {
            when(serviceRequestRepository.findById(999L)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.manualAssign(999L, 99L, "team"))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    // ── AttemptAutoAssign ────────────────────────────────────────────────────

    @Nested
    @DisplayName("attemptAutoAssign(sr)")
    class AttemptAutoAssign {

        @Test
        @DisplayName("when already assigned - returns false (precondition)")
        void whenAlreadyAssigned_thenSkips() {
            ServiceRequest sr = buildEntity(1L, "X", RequestStatus.ASSIGNED);
            sr.setAssignedToId(50L);
            sr.setProperty(buildProperty(20L, buildUser(10L, UserRole.HOST, "kc-10")));

            boolean result = service.attemptAutoAssign(sr);

            assertThat(result).isFalse();
            verifyNoInteractions(propertyTeamService);
        }

        @Test
        @DisplayName("when no property - returns false (precondition)")
        void whenNoProperty_thenSkips() {
            ServiceRequest sr = buildEntity(1L, "X", RequestStatus.PENDING);

            boolean result = service.attemptAutoAssign(sr);

            assertThat(result).isFalse();
            verifyNoInteractions(propertyTeamService);
        }

        @Test
        @DisplayName("when workflow autoAssign disabled - returns false")
        void whenWorkflowDisabled_thenSkips() {
            ServiceRequest sr = buildEntity(1L, "X", RequestStatus.PENDING);
            sr.setOrganizationId(ORG_ID);
            sr.setProperty(buildProperty(20L, buildUser(10L, UserRole.HOST, "kc-10")));

            WorkflowSettings ws = new WorkflowSettings();
            ws.setAutoAssignInterventions(false);
            when(workflowSettingsRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(ws));

            boolean result = service.attemptAutoAssign(sr);

            assertThat(result).isFalse();
            verifyNoInteractions(propertyTeamService);
        }

        @Test
        @DisplayName("when team available - assigns, switches ASSIGNED, logs AUTO_SUCCESS")
        void whenTeamAvailable_thenAssigns() {
            ServiceRequest sr = buildEntity(1L, "X", RequestStatus.PENDING);
            sr.setOrganizationId(ORG_ID);
            User host = buildUser(10L, UserRole.HOST, "kc-10");
            sr.setUser(host);
            sr.setProperty(buildProperty(20L, host));
            sr.setEstimatedDurationHours(3);

            when(workflowSettingsRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());
            when(propertyTeamService.findAvailableTeamForProperty(
                    eq(20L), any(), eq(3), eq("CLEANING"))).thenReturn(Optional.of(50L));
            when(serviceRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Team team = new Team("Equipe A", "", "CLEANING");
            team.setId(50L);
            when(teamRepository.findById(50L)).thenReturn(Optional.of(team));

            boolean result = service.attemptAutoAssign(sr);

            assertThat(result).isTrue();
            assertThat(sr.getAssignedToId()).isEqualTo(50L);
            assertThat(sr.getAssignedToType()).isEqualTo("team");
            // ASSIGNEE, pas payable : personne n'a encore travaille. Le solde ne
            // devient du qu'apres le controle du travail rendu.
            assertThat(sr.getStatus()).isEqualTo(RequestStatus.ASSIGNED);
            assertThat(sr.getAutoAssignStatus()).isEqualTo("found");
            verify(assignmentEventRepository).save(argThat(e ->
                    "AUTO_SUCCESS".equals(((AssignmentEvent) e).getEventType())));
        }

        @Test
        @DisplayName("when no team - increments retry count, sets searching")
        void whenNoTeam_thenIncrementsRetry() {
            ServiceRequest sr = buildEntity(1L, "X", RequestStatus.PENDING);
            sr.setOrganizationId(ORG_ID);
            User host = buildUser(10L, UserRole.HOST, "kc-10");
            sr.setUser(host);
            sr.setProperty(buildProperty(20L, host));

            when(workflowSettingsRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());
            when(propertyTeamService.findAvailableTeamForProperty(any(), any(), any(), anyString()))
                    .thenReturn(Optional.empty());
            when(serviceRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            boolean result = service.attemptAutoAssign(sr);

            assertThat(result).isFalse();
            assertThat(sr.getAutoAssignRetryCount()).isEqualTo(1);
            assertThat(sr.getAutoAssignStatus()).isEqualTo("searching");
            verify(notificationService).notifyAdminsAndManagers(
                    eq(NotificationKey.SERVICE_REQUEST_NO_TEAM_AVAILABLE),
                    anyString(), anyString(), anyString(), any(Map.class));
        }

        @Test
        @DisplayName("when retry count reaches MAX - sets exhausted and ESCALATES")
        void whenMaxRetries_thenEscalates() {
            ServiceRequest sr = buildEntity(1L, "X", RequestStatus.PENDING);
            sr.setOrganizationId(ORG_ID);
            User host = buildUser(10L, UserRole.HOST, "kc-10");
            sr.setUser(host);
            sr.setProperty(buildProperty(20L, host));
            sr.setAutoAssignRetryCount(ServiceRequestService.MAX_AUTO_ASSIGN_RETRIES - 1);

            when(workflowSettingsRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());
            when(propertyTeamService.findAvailableTeamForProperty(any(), any(), any(), nullable(String.class)))
                    .thenReturn(Optional.empty());
            when(serviceRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            // serviceType null path
            sr.setServiceType(null);

            boolean result = service.attemptAutoAssign(sr);

            assertThat(result).isFalse();
            assertThat(sr.getAutoAssignStatus()).isEqualTo("exhausted");
            verify(notificationService).notifyAdminsAndManagers(
                    eq(NotificationKey.SERVICE_REQUEST_ESCALATION),
                    anyString(), anyString(), anyString(), any(Map.class));
            verify(assignmentEventRepository).save(argThat(e ->
                    "ESCALATION".equals(((AssignmentEvent) e).getEventType())));
        }

        @Test
        @DisplayName("when exception thrown internally - returns false silently")
        void whenException_thenReturnsFalse() {
            ServiceRequest sr = buildEntity(1L, "X", RequestStatus.PENDING);
            sr.setOrganizationId(ORG_ID);
            sr.setProperty(buildProperty(20L, buildUser(10L, UserRole.HOST, "kc-10")));

            when(workflowSettingsRepository.findByOrganizationId(ORG_ID))
                    .thenThrow(new RuntimeException("DB down"));

            boolean result = service.attemptAutoAssign(sr);

            assertThat(result).isFalse();
        }
    }

    // ── AttemptAutoAssignByOrgId (scheduler path) ────────────────────────────

    @Nested
    @DisplayName("attemptAutoAssignByOrgId(sr, orgId)")
    class AttemptAutoAssignByOrgId {

        @Test
        void staleSchedulerCopyCannotReplaceAManualAssignment() {
            ServiceRequest stale = buildEntity(1L, "Old snapshot", RequestStatus.PENDING);
            ServiceRequest current = buildEntity(1L, "Current", RequestStatus.ASSIGNED);
            current.setAssignedToId(77L);
            doReturn(Optional.of(current)).when(serviceRequestRepository).findForMutation(1L);
            assertThat(service.attemptAutoAssignByOrgId(stale, ORG_ID)).isFalse();
            assertThat(current.getAssignedToId()).isEqualTo(77L);
            verifyNoInteractions(propertyTeamService, notificationService);
            verify(serviceRequestRepository, never()).save(any());
        }

        @Test
        void staleSchedulerCopyCannotReviveACancelledRequest() {
            ServiceRequest stale = buildEntity(1L, "Old snapshot", RequestStatus.PENDING);
            ServiceRequest current = buildEntity(1L, "Cancelled", RequestStatus.CANCELLED);
            doReturn(Optional.of(current)).when(serviceRequestRepository).findForMutation(1L);
            assertThat(service.attemptAutoAssignByOrgId(stale, ORG_ID)).isFalse();
            verifyNoInteractions(propertyTeamService, notificationService);
            verify(serviceRequestRepository, never()).save(any());
        }

        @Test
        void closedRequestsAreNeverReassignedByEitherEntryPoint() {
            for (RequestStatus status : List.of(RequestStatus.CANCELLED, RequestStatus.COMPLETED, RequestStatus.IN_PROGRESS)) {
                ServiceRequest sr = buildEntity(1L, "Closed", status);
                sr.setProperty(buildProperty(20L, buildUser(10L, UserRole.HOST, "kc-10")));
                assertThat(service.attemptAutoAssign(sr)).isFalse();
                assertThat(service.attemptAutoAssignByOrgId(sr, ORG_ID)).isFalse();
                assertThat(sr.getStatus()).isEqualTo(status);
            }
            verifyNoInteractions(propertyTeamService, notificationService);
            verify(serviceRequestRepository, never()).save(any());
        }

        @Test
        void explicitOrganizationCannotOverrideTheRequestsOwner() {
            ServiceRequest sr = buildEntity(1L, "Other organization", RequestStatus.PENDING);
            assertThatThrownBy(() -> service.attemptAutoAssignByOrgId(sr, 99L))
                    .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
            assertThatThrownBy(() -> service.attemptAutoAssignByOrgId(sr, null))
                    .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
            verifyNoInteractions(propertyTeamService, notificationService);
        }

        @Test
        void directSchedulerEntryHonorsDisabledAutomation() {
            ServiceRequest sr = buildEntity(1L, "Paused automation", RequestStatus.PENDING);
            sr.setProperty(buildProperty(20L, buildUser(10L, UserRole.HOST, "kc-10")));
            WorkflowSettings settings = new WorkflowSettings();
            settings.setAutoAssignInterventions(false);
            when(workflowSettingsRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(settings));
            assertThat(service.attemptAutoAssignByOrgId(sr, ORG_ID)).isFalse();
            verifyNoInteractions(propertyTeamService, notificationService);
            verify(serviceRequestRepository, never()).save(any());
        }

        @Test
        @DisplayName("when team available - assigns and notifies via orgId helper")
        void whenAvailable_thenAssignsViaSchedulerPath() {
            ServiceRequest sr = buildEntity(1L, "T", RequestStatus.PENDING);
            User host = buildUser(10L, UserRole.HOST, "kc-10");
            sr.setUser(host);
            sr.setProperty(buildProperty(20L, host));

            when(propertyTeamService.findAvailableTeamForProperty(
                    eq(20L), any(), any(), eq("CLEANING"), eq(ORG_ID))).thenReturn(Optional.of(60L));
            when(serviceRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            Team team = new Team("Team Scheduler", "", "CLEANING");
            team.setId(60L);
            when(teamRepository.findById(60L)).thenReturn(Optional.of(team));

            boolean result = service.attemptAutoAssignByOrgId(sr, ORG_ID);

            assertThat(result).isTrue();
            assertThat(sr.getAssignedToId()).isEqualTo(60L);
            verify(notificationService).notifyAdminsAndManagersByOrgId(
                    eq(ORG_ID), eq(NotificationKey.SERVICE_REQUEST_TEAM_ASSIGNED),
                    anyString(), anyString(), anyString(), any());
        }

        @Test
        @DisplayName("when no team and max retries - escalates via scheduler path")
        void whenNoTeamMaxRetries_thenEscalatesScheduler() {
            ServiceRequest sr = buildEntity(1L, "T", RequestStatus.PENDING);
            User host = buildUser(10L, UserRole.HOST, "kc-10");
            sr.setUser(host);
            sr.setProperty(buildProperty(20L, host));
            sr.setAutoAssignRetryCount(ServiceRequestService.MAX_AUTO_ASSIGN_RETRIES - 1);

            when(propertyTeamService.findAvailableTeamForProperty(
                    any(), any(), any(), anyString(), eq(ORG_ID))).thenReturn(Optional.empty());
            when(serviceRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            boolean result = service.attemptAutoAssignByOrgId(sr, ORG_ID);

            assertThat(result).isFalse();
            assertThat(sr.getAutoAssignStatus()).isEqualTo("exhausted");
            verify(notificationService).notifyAdminsAndManagersByOrgId(
                    eq(ORG_ID), eq(NotificationKey.SERVICE_REQUEST_ESCALATION),
                    anyString(), anyString(), anyString(), any());
        }

        @Test
        @DisplayName("when no team and not max - increments retry only")
        void whenNoTeamNotMax_thenIncrements() {
            ServiceRequest sr = buildEntity(1L, "T", RequestStatus.PENDING);
            User host = buildUser(10L, UserRole.HOST, "kc-10");
            sr.setUser(host);
            sr.setProperty(buildProperty(20L, host));

            when(propertyTeamService.findAvailableTeamForProperty(
                    any(), any(), any(), anyString(), eq(ORG_ID))).thenReturn(Optional.empty());
            when(serviceRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            boolean result = service.attemptAutoAssignByOrgId(sr, ORG_ID);

            assertThat(result).isFalse();
            assertThat(sr.getAutoAssignRetryCount()).isEqualTo(1);
            assertThat(sr.getAutoAssignStatus()).isEqualTo("searching");
        }

        @Test
        @DisplayName("precondition - already assigned - returns false")
        void whenAlreadyAssigned_thenSkips() {
            ServiceRequest sr = buildEntity(1L, "T", RequestStatus.ASSIGNED);
            sr.setAssignedToId(33L);
            sr.setProperty(buildProperty(20L, buildUser(10L, UserRole.HOST, "kc-10")));

            assertThat(service.attemptAutoAssignByOrgId(sr, ORG_ID)).isFalse();
            verifyNoInteractions(propertyTeamService);
        }

        @Test
        @DisplayName("when exception thrown - returns false silently")
        void whenException_thenReturnsFalse() {
            ServiceRequest sr = buildEntity(1L, "T", RequestStatus.PENDING);
            User host = buildUser(10L, UserRole.HOST, "kc-10");
            sr.setUser(host);
            sr.setProperty(buildProperty(20L, host));

            when(propertyTeamService.findAvailableTeamForProperty(
                    any(), any(), any(), anyString(), eq(ORG_ID)))
                    .thenThrow(new RuntimeException("Boom"));

            assertThat(service.attemptAutoAssignByOrgId(sr, ORG_ID)).isFalse();
        }
    }

    // ── createInterventionFromPaidServiceRequest ─────────────────────────────

    @Nested
    @DisplayName("createInterventionFromPaidServiceRequest(sr)")
    class CreateInterventionFromPaid {

        @Test
        @DisplayName("when intervention already exists - skips and returns null")
        void whenAlreadyExists_thenReturnsNull() {
            ServiceRequest sr = buildEntity(1L, "T", RequestStatus.AWAITING_PAYMENT);
            when(interventionRepository.existsByServiceRequestId(1L)).thenReturn(true);

            Intervention result = service.createInterventionFromPaidServiceRequest(sr);

            assertThat(result).isNull();
            verify(interventionRepository, never()).save(any());
        }

        @Test
        @DisplayName("when SR assigned to user - sets assigned user on intervention")
        void whenAssignedToUser_thenAttaches() {
            User assignee = buildUser(77L, UserRole.TECHNICIAN, "kc-77");
            User requestor = buildUser(10L, UserRole.HOST, "kc-10");
            ServiceRequest sr = buildEntity(1L, "Repair", RequestStatus.AWAITING_PAYMENT);
            sr.setUser(requestor);
            sr.setProperty(buildProperty(20L, requestor));
            sr.setAssignedToId(77L);
            sr.setAssignedToType("user");
            sr.setOrganizationId(ORG_ID);
            sr.setEstimatedCost(BigDecimal.valueOf(150));
            sr.setEstimatedDurationHours(2);
            sr.setServiceType(ServiceType.PLUMBING_REPAIR);

            when(interventionRepository.existsByServiceRequestId(1L)).thenReturn(false);
            when(userRepository.findById(77L)).thenReturn(Optional.of(assignee));
            when(interventionRepository.save(any())).thenAnswer(inv -> {
                Intervention i = inv.getArgument(0);
                i.setId(500L);
                return i;
            });

            Intervention result = service.createInterventionFromPaidServiceRequest(sr);

            assertThat(result).isNotNull();
            assertThat(result.getAssignedUser()).isEqualTo(assignee);
            assertThat(result.getAssignedTechnicianId()).isEqualTo(77L);
            assertThat(result.getServiceRequest()).isEqualTo(sr);
            assertThat(result.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(result.getType()).isEqualTo(InterventionType.PREVENTIVE_MAINTENANCE.name());
            verify(documentOutbox).requestInvoice(eq(1L), any(), any());
            verify(notificationService).notifyAdminsAndManagers(
                    eq(NotificationKey.INTERVENTION_AWAITING_VALIDATION),
                    anyString(), anyString(), anyString(), any(Map.class));
        }

        @Test
        @DisplayName("when SR assigned to team - sets teamId on intervention")
        void whenAssignedToTeam_thenSetsTeamId() {
            User requestor = buildUser(10L, UserRole.HOST, "kc-10");
            ServiceRequest sr = buildEntity(1L, "Cleaning", RequestStatus.AWAITING_PAYMENT);
            sr.setUser(requestor);
            sr.setProperty(buildProperty(20L, requestor));
            sr.setAssignedToId(88L);
            sr.setAssignedToType("team");
            sr.setServiceType(ServiceType.DEEP_CLEANING);

            when(interventionRepository.existsByServiceRequestId(1L)).thenReturn(false);
            when(interventionRepository.save(any())).thenAnswer(inv -> {
                Intervention i = inv.getArgument(0);
                i.setId(501L);
                return i;
            });

            Intervention result = service.createInterventionFromPaidServiceRequest(sr);

            assertThat(result.getTeamId()).isEqualTo(88L);
            assertThat(result.getType()).isEqualTo(InterventionType.CLEANING.name());
        }

        @Test
        @DisplayName("when reservationId set - links intervention to reservation")
        void whenReservationId_thenLinks() {
            User requestor = buildUser(10L, UserRole.HOST, "kc-10");
            ServiceRequest sr = buildEntity(1L, "Cleaning", RequestStatus.AWAITING_PAYMENT);
            sr.setUser(requestor);
            sr.setProperty(buildProperty(20L, requestor));
            sr.setReservationId(300L);
            sr.setServiceType(ServiceType.CLEANING);

            Reservation reservation = new Reservation();
            reservation.setId(300L);

            when(interventionRepository.existsByServiceRequestId(1L)).thenReturn(false);
            when(interventionRepository.save(any())).thenAnswer(inv -> {
                Intervention i = inv.getArgument(0);
                i.setId(502L);
                return i;
            });
            when(reservationRepository.findById(300L)).thenReturn(Optional.of(reservation));

            Intervention result = service.createInterventionFromPaidServiceRequest(sr);

            assertThat(result).isNotNull();
            verify(reservationRepository).save(reservation);
            assertThat(reservation.getIntervention()).isEqualTo(result);
        }

        @Test
        @DisplayName("title and description truncation - over 255/500 chars")
        void whenTitleOver255_thenTruncates() {
            String longTitle = "a".repeat(300);
            String longDesc = "b".repeat(600);
            User requestor = buildUser(10L, UserRole.HOST, "kc-10");
            ServiceRequest sr = buildEntity(1L, longTitle, RequestStatus.AWAITING_PAYMENT);
            sr.setDescription(longDesc);
            sr.setUser(requestor);
            sr.setProperty(buildProperty(20L, requestor));
            sr.setServiceType(ServiceType.CLEANING);

            when(interventionRepository.existsByServiceRequestId(1L)).thenReturn(false);
            when(interventionRepository.save(any())).thenAnswer(inv -> {
                Intervention i = inv.getArgument(0);
                i.setId(510L);
                return i;
            });

            Intervention result = service.createInterventionFromPaidServiceRequest(sr);

            assertThat(result.getTitle()).hasSize(255);
            assertThat(result.getDescription()).hasSize(500);
        }

        @Test
        @DisplayName("Outbox failure aborts invoice scheduling before notification")
        void whenOutboxFails_thenPropagates() {
            User requestor = buildUser(10L, UserRole.HOST, "kc-10");
            ServiceRequest sr = buildEntity(1L, "T", RequestStatus.AWAITING_PAYMENT);
            sr.setUser(requestor);
            sr.setProperty(buildProperty(20L, requestor));
            sr.setServiceType(ServiceType.CLEANING);

            when(interventionRepository.existsByServiceRequestId(1L)).thenReturn(false);
            when(interventionRepository.save(any())).thenAnswer(inv -> {
                Intervention i = inv.getArgument(0);
                i.setId(520L);
                return i;
            });
            doThrow(new RuntimeException("outbox unavailable")).when(documentOutbox)
                    .requestInvoice(any(), any(), any());

            assertThatThrownBy(() -> service.createInterventionFromPaidServiceRequest(sr))
                    .isInstanceOf(RuntimeException.class).hasMessage("outbox unavailable");
            verifyNoInteractions(notificationService);
        }
    }

    // ── searchWithRoleBasedAccess ────────────────────────────────────────────

    @Nested
    @DisplayName("searchWithRoleBasedAccess(pageable, ..., jwt)")
    class SearchWithRoleBasedAccess {

        private Jwt buildJwt(String role, String sub) {
            Jwt jwt = mock(Jwt.class);
            lenient().when(jwt.getClaim("realm_access"))
                    .thenReturn(Map.of("roles", List.of(role)));
            lenient().when(jwt.getSubject()).thenReturn(sub);
            return jwt;
        }

        @Test
        @DisplayName("when jwt null - falls back to standard search")
        void whenNoJwt_thenFallback() {
            Pageable pageable = PageRequest.of(0, 10);
            when(serviceRequestRepository.findAllWithRelations(ORG_ID)).thenReturn(List.of());

            Page<ServiceRequestDto> result = service.searchWithRoleBasedAccess(
                    pageable, null, null, null, null, null, null);

            assertThat(result.getContent()).isEmpty();
        }

        @Test
        @DisplayName("HOST - filters to only their own properties")
        void whenHost_thenFiltersByOwner() {
            Pageable pageable = PageRequest.of(0, 10);
            Jwt jwt = buildJwt("HOST", "kc-host");
            User host = buildUser(10L, UserRole.HOST, "kc-host");
            User other = buildUser(99L, UserRole.HOST, "kc-other");

            ServiceRequest mine = buildEntity(1L, "Mine", RequestStatus.PENDING);
            mine.setProperty(buildProperty(20L, host));
            mine.setUser(host);

            ServiceRequest theirs = buildEntity(2L, "Theirs", RequestStatus.PENDING);
            theirs.setProperty(buildProperty(21L, other));
            theirs.setUser(other);

            when(serviceRequestRepository.findAllWithRelations(ORG_ID))
                    .thenReturn(List.of(mine, theirs));
            when(userRepository.findByKeycloakId("kc-host"))
                    .thenReturn(Optional.of(host));
            ServiceRequestDto myDto = new ServiceRequestDto();
            myDto.id = 1L;
            when(serviceRequestMapper.toDto(mine)).thenReturn(myDto);

            Page<ServiceRequestDto> result = service.searchWithRoleBasedAccess(
                    pageable, null, null, null, null, null, jwt);

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).id).isEqualTo(1L);
        }

        @Test
        @DisplayName("TECHNICIAN - filters by assignedToId user match")
        void whenTechnician_thenFiltersByAssigned() {
            Pageable pageable = PageRequest.of(0, 10);
            Jwt jwt = buildJwt("TECHNICIAN", "kc-tech");
            User tech = buildUser(50L, UserRole.TECHNICIAN, "kc-tech");

            ServiceRequest assigned = buildEntity(1L, "Mine", RequestStatus.ASSIGNED);
            assigned.setAssignedToId(50L);
            assigned.setAssignedToType("user");
            assigned.setProperty(buildProperty(20L, tech));

            ServiceRequest other = buildEntity(2L, "Other", RequestStatus.ASSIGNED);
            other.setAssignedToId(99L);
            other.setAssignedToType("user");
            other.setProperty(buildProperty(20L, tech));

            when(serviceRequestRepository.findAllWithRelations(ORG_ID))
                    .thenReturn(List.of(assigned, other));
            when(userRepository.findByKeycloakId("kc-tech"))
                    .thenReturn(Optional.of(tech));
            ServiceRequestDto dto = new ServiceRequestDto();
            dto.id = 1L;
            when(serviceRequestMapper.toDto(assigned)).thenReturn(dto);

            Page<ServiceRequestDto> result = service.searchWithRoleBasedAccess(
                    pageable, null, null, null, null, null, jwt);

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).id).isEqualTo(1L);
        }

        @Test
        @DisplayName("TECHNICIAN - filter via team membership")
        void whenTechnicianViaTeam_thenAllowed() {
            Pageable pageable = PageRequest.of(0, 10);
            Jwt jwt = buildJwt("TECHNICIAN", "kc-tech");
            User tech = buildUser(50L, UserRole.TECHNICIAN, "kc-tech");

            ServiceRequest viaTeam = buildEntity(1L, "Team SR", RequestStatus.ASSIGNED);
            viaTeam.setAssignedToId(70L);
            viaTeam.setAssignedToType("team");
            viaTeam.setProperty(buildProperty(20L, tech));

            // Team with tech as member
            Team team = new Team("Eq", "", "CLEANING");
            team.setId(70L);
            TeamMember tm = new TeamMember(team, tech, "TECHNICIAN");
            team.setMembers(List.of(tm));

            when(serviceRequestRepository.findAllWithRelations(ORG_ID))
                    .thenReturn(List.of(viaTeam));
            when(userRepository.findByKeycloakId("kc-tech")).thenReturn(Optional.of(tech));
            when(teamRepository.findById(70L)).thenReturn(Optional.of(team));
            ServiceRequestDto dto = new ServiceRequestDto();
            dto.id = 1L;
            when(serviceRequestMapper.toDto(viaTeam)).thenReturn(dto);

            Page<ServiceRequestDto> result = service.searchWithRoleBasedAccess(
                    pageable, null, null, null, null, null, jwt);

            assertThat(result.getContent()).hasSize(1);
        }

        @Test
        @DisplayName("SUPER_MANAGER - sees all")
        void whenSuperManager_thenAllVisible() {
            Pageable pageable = PageRequest.of(0, 10);
            Jwt jwt = buildJwt("SUPER_MANAGER", "kc-mgr");
            ServiceRequest sr1 = buildEntity(1L, "A", RequestStatus.PENDING);
            sr1.setProperty(buildProperty(20L, buildUser(10L, UserRole.HOST, "k1")));
            ServiceRequest sr2 = buildEntity(2L, "B", RequestStatus.ASSIGNED);
            sr2.setProperty(buildProperty(20L, buildUser(10L, UserRole.HOST, "k1")));

            when(serviceRequestRepository.findAllWithRelations(ORG_ID))
                    .thenReturn(List.of(sr1, sr2));
            ServiceRequestDto d1 = new ServiceRequestDto();
            d1.id = 1L;
            ServiceRequestDto d2 = new ServiceRequestDto();
            d2.id = 2L;
            when(serviceRequestMapper.toDto(sr1)).thenReturn(d1);
            when(serviceRequestMapper.toDto(sr2)).thenReturn(d2);

            Page<ServiceRequestDto> result = service.searchWithRoleBasedAccess(
                    pageable, null, null, null, null, null, jwt);

            assertThat(result.getContent()).hasSize(2);
        }

        @Test
        @DisplayName("SUPER_ADMIN - sees all")
        void whenSuperAdmin_thenAllVisible() {
            Pageable pageable = PageRequest.of(0, 10);
            Jwt jwt = buildJwt("SUPER_ADMIN", "kc-admin");
            ServiceRequest sr = buildEntity(1L, "A", RequestStatus.PENDING);
            sr.setProperty(buildProperty(20L, buildUser(10L, UserRole.HOST, "k1")));

            when(serviceRequestRepository.findAllWithRelations(ORG_ID))
                    .thenReturn(List.of(sr));
            ServiceRequestDto dto = new ServiceRequestDto();
            dto.id = 1L;
            when(serviceRequestMapper.toDto(sr)).thenReturn(dto);

            Page<ServiceRequestDto> result = service.searchWithRoleBasedAccess(
                    pageable, null, null, null, null, null, jwt);

            assertThat(result.getContent()).hasSize(1);
        }

        @Test
        @DisplayName("filters by reservationId when provided")
        void whenReservationIdProvided_thenFilters() {
            Pageable pageable = PageRequest.of(0, 10);
            Jwt jwt = buildJwt("SUPER_ADMIN", "kc-admin");
            User host = buildUser(10L, UserRole.HOST, "k1");

            ServiceRequest match = buildEntity(1L, "Match", RequestStatus.PENDING);
            match.setProperty(buildProperty(20L, host));
            match.setReservationId(300L);

            ServiceRequest other = buildEntity(2L, "Other", RequestStatus.PENDING);
            other.setProperty(buildProperty(20L, host));
            other.setReservationId(999L);

            when(serviceRequestRepository.findAllWithRelations(ORG_ID))
                    .thenReturn(List.of(match, other));
            ServiceRequestDto dto = new ServiceRequestDto();
            dto.id = 1L;
            when(serviceRequestMapper.toDto(match)).thenReturn(dto);

            Page<ServiceRequestDto> result = service.searchWithRoleBasedAccess(
                    pageable, null, null, 300L, null, null, jwt);

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).id).isEqualTo(1L);
        }
    }

    // ── getPlanningServiceRequests (deplace de ServiceRequestController, T-ARCH-01) ──

    @Nested
    @DisplayName("getPlanningServiceRequests")
    class GetPlanningServiceRequests {

        private final LocalDateTime from = LocalDateTime.of(2026, 3, 1, 0, 0);
        private final LocalDateTime to = LocalDateTime.of(2026, 9, 1, 23, 59);

        @Test
        void whenNoPropertyIds_thenUsesGeneralQuery() {
            when(serviceRequestRepository.findByStatusAndDesiredDateBetween(
                    RequestStatus.AWAITING_PAYMENT, from, to, ORG_ID))
                    .thenReturn(List.of());

            List<Map<String, Object>> result = service.getPlanningServiceRequests(null, from, to);

            assertThat(result).isEmpty();
            verify(serviceRequestRepository).findByStatusAndDesiredDateBetween(
                    RequestStatus.AWAITING_PAYMENT, from, to, ORG_ID);
        }

        @Test
        void whenPropertyIdsProvided_thenUsesPropertyQuery() {
            ServiceRequest sr = new ServiceRequest();
            sr.setId(5L);
            sr.setTitle("Test SR");
            sr.setEstimatedDurationHours(2);
            when(serviceRequestRepository.findByStatusAndPropertyIdsAndDesiredDateBetween(
                    RequestStatus.AWAITING_PAYMENT, List.of(10L), from, to, ORG_ID))
                    .thenReturn(List.of(sr));

            List<Map<String, Object>> result = service.getPlanningServiceRequests(List.of(10L), from, to);

            assertThat(result).hasSize(1);
            assertThat(result.get(0)).containsEntry("id", 5L).containsEntry("status", "AWAITING_PAYMENT");
        }

        @Test
        void whenSrHasUserAssignee_thenIncludesNameInResult() {
            ServiceRequest sr = new ServiceRequest();
            sr.setId(8L);
            sr.setTitle("Task");
            sr.setEstimatedDurationHours(2);
            sr.setAssignedToType("user");
            sr.setAssignedToId(50L);
            sr.setDesiredDate(LocalDateTime.of(2026, 4, 1, 9, 0));

            when(serviceRequestRepository.findByStatusAndDesiredDateBetween(
                    RequestStatus.AWAITING_PAYMENT, from, to, ORG_ID))
                    .thenReturn(List.of(sr));

            User user = new User();
            user.setId(50L);
            user.setFirstName("Alice");
            user.setLastName("Test");
            when(userRepository.findAllById(List.of(50L))).thenReturn(List.of(user));

            List<Map<String, Object>> result = service.getPlanningServiceRequests(null, from, to);

            assertThat(result).hasSize(1);
            assertThat(result.get(0)).containsEntry("assignedToName", "Alice Test");
            assertThat(result.get(0)).containsEntry("startTime", "09:00");
            assertThat(result.get(0)).containsEntry("endTime", "11:00");
        }

        @Test
        void whenSrHasTeamAssignee_thenIncludesTeamName() {
            ServiceRequest sr = new ServiceRequest();
            sr.setId(9L);
            sr.setTitle("Task");
            sr.setEstimatedDurationHours(3);
            sr.setAssignedToType("team");
            sr.setAssignedToId(60L);

            when(serviceRequestRepository.findByStatusAndDesiredDateBetween(
                    RequestStatus.AWAITING_PAYMENT, from, to, ORG_ID))
                    .thenReturn(List.of(sr));

            Team team = new Team();
            team.setId(60L);
            team.setName("Team Bravo");
            when(teamRepository.findAllById(List.of(60L))).thenReturn(List.of(team));

            List<Map<String, Object>> result = service.getPlanningServiceRequests(null, from, to);

            assertThat(result).hasSize(1);
            assertThat(result.get(0)).containsEntry("assignedToName", "Team Bravo");
            assertThat(result.get(0)).containsEntry("startDate", (Object) null); // no desiredDate
        }

        @Test
        void whenAssigneeUnknown_thenFallsBackToIdLabel() {
            ServiceRequest sr = new ServiceRequest();
            sr.setId(11L);
            sr.setTitle("Task");
            sr.setAssignedToType("user");
            sr.setAssignedToId(77L);

            when(serviceRequestRepository.findByStatusAndDesiredDateBetween(
                    RequestStatus.AWAITING_PAYMENT, from, to, ORG_ID))
                    .thenReturn(List.of(sr));
            when(userRepository.findAllById(List.of(77L))).thenReturn(List.of());

            List<Map<String, Object>> result = service.getPlanningServiceRequests(null, from, to);

            assertThat(result.get(0)).containsEntry("assignedToName", "Utilisateur #77");
        }
    }
}
