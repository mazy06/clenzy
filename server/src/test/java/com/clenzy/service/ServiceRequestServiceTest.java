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
import org.springframework.kafka.core.KafkaTemplate;
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

    @Mock private ServiceRequestRepository serviceRequestRepository;
    @Mock private UserRepository userRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private TeamRepository teamRepository;
    @Mock private NotificationService notificationService;
    @Mock private PropertyTeamService propertyTeamService;
    @Mock private KafkaTemplate<String, Object> kafkaTemplate;
    @Mock private ServiceRequestMapper serviceRequestMapper;
    @Mock private AssignmentEventRepository assignmentEventRepository;
    @Mock private WorkflowSettingsRepository workflowSettingsRepository;

    private TenantContext tenantContext;
    private ServiceRequestService service;

    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);

        service = new ServiceRequestService(
                serviceRequestRepository, userRepository, propertyRepository,
                interventionRepository, reservationRepository, teamRepository, notificationService,
                propertyTeamService, kafkaTemplate, tenantContext, serviceRequestMapper,
                assignmentEventRepository, workflowSettingsRepository);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private ServiceRequest buildEntity(Long id, String title, RequestStatus status) {
        ServiceRequest sr = new ServiceRequest();
        sr.setId(id);
        sr.setTitle(title);
        sr.setStatus(status);
        sr.setPriority(Priority.NORMAL);
        sr.setServiceType(ServiceType.CLEANING);
        sr.setDesiredDate(LocalDateTime.now().plusDays(3));
        return sr;
    }

    private ServiceRequestDto buildDto() {
        ServiceRequestDto dto = new ServiceRequestDto();
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
                    anyString(), anyString(), anyString());
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
                    anyString(), anyString(), anyString());
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
                    contains("refusee"), anyString(), anyString());
            verify(assignmentEventRepository).save(argThat(e ->
                    "REFUSE".equals(((AssignmentEvent) e).getEventType())));
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

    // ── ManualAssign ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("manualAssign(srId, assignedToId, type)")
    class ManualAssign {

        @Test
        @DisplayName("when SR PENDING - assigns and switches to AWAITING_PAYMENT")
        void whenPending_thenAssigns() {
            ServiceRequest sr = buildEntity(1L, "T", RequestStatus.PENDING);
            when(serviceRequestRepository.findById(1L)).thenReturn(Optional.of(sr));
            when(serviceRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(serviceRequestMapper.toDto(any())).thenReturn(new ServiceRequestDto());

            service.manualAssign(1L, 99L, "user");

            assertThat(sr.getAssignedToId()).isEqualTo(99L);
            assertThat(sr.getAssignedToType()).isEqualTo("user");
            assertThat(sr.getStatus()).isEqualTo(RequestStatus.AWAITING_PAYMENT);
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
        @DisplayName("when team available - assigns, switches AWAITING_PAYMENT, logs AUTO_SUCCESS")
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
            assertThat(sr.getStatus()).isEqualTo(RequestStatus.AWAITING_PAYMENT);
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
                    anyString(), anyString(), anyString());
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
                    anyString(), anyString(), anyString());
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
                    anyString(), anyString(), anyString());
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
                    anyString(), anyString(), anyString());
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
            verify(kafkaTemplate).send(anyString(), anyString(), any());
            verify(notificationService).notifyAdminsAndManagers(
                    eq(NotificationKey.INTERVENTION_AWAITING_VALIDATION),
                    anyString(), anyString(), anyString());
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
        @DisplayName("kafka throws - notification still sent (resilient)")
        void whenKafkaThrows_thenSwallows() {
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
            doThrow(new RuntimeException("kafka down")).when(kafkaTemplate)
                    .send(anyString(), anyString(), any());

            // Should not throw
            Intervention result = service.createInterventionFromPaidServiceRequest(sr);
            assertThat(result).isNotNull();
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

}
