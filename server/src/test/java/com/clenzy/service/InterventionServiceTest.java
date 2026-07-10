package com.clenzy.service;

import com.clenzy.dto.CreateInterventionRequest;
import com.clenzy.dto.InterventionResponse;
import com.clenzy.dto.UpdateInterventionRequest;
import com.clenzy.exception.NotFoundException;
import com.clenzy.exception.UnauthorizedException;
import com.clenzy.model.*;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InterventionServiceTest {

    @Mock private InterventionRepository interventionRepository;
    @Mock private UserRepository userRepository;
    @Mock private TeamRepository teamRepository;
    @Mock private NotificationService notificationService;
    @Mock private TenantContext tenantContext;
    @Mock private InterventionPhotoService photoService;
    @Mock private InterventionMapper interventionMapper;
    @Mock private InterventionAccessPolicy accessPolicy;
    @Mock private com.clenzy.service.pricing.CleaningPricingEngine cleaningPricingEngine;
    @Mock private com.clenzy.service.email.MissionAssignmentEmailComposer missionAssignmentEmailComposer;

    private InterventionService service;

    private Property property;
    private User owner;
    private User technician;

    @BeforeEach
    void setUp() {
        service = new InterventionService(
                interventionRepository, userRepository, teamRepository,
                notificationService, tenantContext,
                photoService, interventionMapper, accessPolicy,
                cleaningPricingEngine, missionAssignmentEmailComposer);

        owner = new User();
        owner.setId(10L);
        owner.setKeycloakId("owner-kc");
        owner.setFirstName("Jean");
        owner.setLastName("Dupont");
        owner.setEmail("jean@example.com");

        technician = new User();
        technician.setId(20L);
        technician.setKeycloakId("tech-kc");
        technician.setFirstName("Marie");
        technician.setLastName("Martin");
        technician.setEmail("marie@example.com");

        property = new Property();
        property.setId(100L);
        property.setName("Appartement Paris");
        property.setAddress("1 rue de Rivoli");
        property.setOwner(owner);
    }

    private Jwt mockJwtWithRole(String role) {
        Jwt jwt = mock(Jwt.class);
        lenient().when(jwt.getClaim("realm_access")).thenReturn(Map.of("roles", List.of(role)));
        lenient().when(jwt.getSubject()).thenReturn("test-kc");
        return jwt;
    }

    private CreateInterventionRequest buildCreateRequest() {
        return new CreateInterventionRequest(
                "Reparation fuite",
                "Fuite robinet cuisine",
                "PLUMBING",
                "HIGH",
                property.getId(),
                owner.getId(),
                "2026-03-01T10:00:00",
                null,
                null,
                null
        );
    }

    private InterventionResponse buildResultResponse(Long id, String status, String title) {
        return InterventionResponse.builder()
                .id(id)
                .title(title)
                .status(status)
                .propertyName("Appartement Paris")
                .build();
    }

    private Intervention buildIntervention(Long id, InterventionStatus status) {
        Intervention intervention = new Intervention();
        intervention.setId(id);
        intervention.setOrganizationId(1L);
        intervention.setTitle("Test Intervention");
        intervention.setStatus(status);
        intervention.setProperty(property);
        intervention.setRequestor(owner);
        return intervention;
    }

    @Nested
    @DisplayName("create(request, jwt)")
    class Create {

        @Test
        @DisplayName("HOST user creates intervention with AWAITING_VALIDATION status")
        void whenHostCreates_thenStatusIsAwaitingValidation() {
            Jwt jwt = mockJwtWithRole("HOST");
            CreateInterventionRequest request = buildCreateRequest();

            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(interventionRepository.save(any(Intervention.class))).thenAnswer(inv -> {
                Intervention saved = inv.getArgument(0);
                saved.setId(1L);
                return saved;
            });

            InterventionResponse resultResponse = InterventionResponse.builder()
                    .id(1L).title("Reparation fuite").status("AWAITING_VALIDATION")
                    .propertyName("Appartement Paris").build();
            when(interventionMapper.convertToResponse(any(Intervention.class))).thenReturn(resultResponse);

            InterventionResponse result = service.create(request, jwt);

            assertThat(result.status()).isEqualTo("AWAITING_VALIDATION");
            assertThat(result.estimatedCost()).isNull();
            verify(interventionMapper).apply(eq(request), any(Intervention.class));
            verify(interventionRepository).save(any(Intervention.class));
        }

        @Test
        @DisplayName("platform staff creates intervention with PENDING status")
        void whenPlatformStaffCreates_thenStatusIsPending() {
            Jwt jwt = mockJwtWithRole("SUPER_MANAGER");
            CreateInterventionRequest request = buildCreateRequest();

            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(interventionRepository.save(any(Intervention.class))).thenAnswer(inv -> {
                Intervention saved = inv.getArgument(0);
                saved.setId(1L);
                return saved;
            });

            InterventionResponse resultResponse = buildResultResponse(1L, "PENDING", "Reparation fuite");
            when(interventionMapper.convertToResponse(any(Intervention.class))).thenReturn(resultResponse);

            InterventionResponse result = service.create(request, jwt);

            assertThat(result.status()).isEqualTo("PENDING");
            verify(interventionRepository).save(any(Intervention.class));
        }

        @Test
        @DisplayName("unauthorized role throws UnauthorizedException")
        void whenUnauthorizedRole_thenThrows() {
            Jwt jwt = mockJwtWithRole("TECHNICIAN");
            CreateInterventionRequest request = buildCreateRequest();

            assertThatThrownBy(() -> service.create(request, jwt))
                    .isInstanceOf(UnauthorizedException.class);
        }
    }

    @Nested
    @DisplayName("update(id, request, jwt)")
    class Update {

        @Test
        @DisplayName("when found and authorized - applies changes and saves")
        void whenFoundAndAuthorized_thenUpdatesAndReturnsResponse() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            UpdateInterventionRequest updateRequest = new UpdateInterventionRequest(
                    "Updated Title", null, null, "CRITICAL", null, null, null, null, null);

            InterventionResponse resultResponse = buildResultResponse(1L, "PENDING", "Updated Title");

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any(Intervention.class))).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToResponse(any(Intervention.class))).thenReturn(resultResponse);

            InterventionResponse result = service.update(1L, updateRequest, jwt);

            assertThat(result.title()).isEqualTo("Updated Title");
            verify(interventionMapper).applyUpdate(eq(updateRequest), eq(intervention));
            verify(interventionRepository).save(intervention);
        }

        @Test
        @DisplayName("when not found - throws NotFoundException")
        void whenNotFound_thenThrowsNotFoundException() {
            Jwt jwt = mock(Jwt.class);
            when(interventionRepository.findById(999L)).thenReturn(Optional.empty());

            UpdateInterventionRequest request = new UpdateInterventionRequest(
                    null, null, null, null, null, null, null, null, null);

            assertThatThrownBy(() -> service.update(999L, request, jwt))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("getById(id, jwt)")
    class GetById {

        @Test
        @DisplayName("when found and authorized - returns response")
        void whenFoundAndAuthorized_thenReturnsResponse() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            InterventionResponse resultResponse = buildResultResponse(1L, "PENDING", "Test Intervention");

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionMapper.convertToResponse(intervention)).thenReturn(resultResponse);

            InterventionResponse result = service.getById(1L, jwt);

            assertThat(result).isNotNull();
            assertThat(result.id()).isEqualTo(1L);
            assertThat(result.title()).isEqualTo("Test Intervention");
        }

        @Test
        @DisplayName("when not found - throws NotFoundException")
        void whenNotFound_thenThrowsNotFoundException() {
            Jwt jwt = mock(Jwt.class);
            when(interventionRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getById(999L, jwt))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("delete(id, jwt)")
    class Delete {

        @Test
        @DisplayName("admin can delete intervention")
        void whenAdmin_thenDeletesIntervention() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            service.delete(1L, jwt);

            verify(interventionRepository).deleteById(1L);
        }

        @Test
        @DisplayName("non-admin throws UnauthorizedException")
        void whenNonAdmin_thenThrowsUnauthorized() {
            Jwt jwt = mockJwtWithRole("SUPER_MANAGER");
            lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            assertThatThrownBy(() -> service.delete(1L, jwt))
                    .isInstanceOf(UnauthorizedException.class);
        }

        @Test
        @DisplayName("when not found - throws NotFoundException")
        void whenNotFound_thenThrowsNotFoundException() {
            Jwt jwt = mock(Jwt.class);
            when(interventionRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.delete(999L, jwt))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("assign(id, userId, teamId, jwt)")
    class Assign {

        @Test
        @DisplayName("assigns user and clears team")
        void whenUserProvided_thenAssignsUserAndClearsTeam() {
            Jwt jwt = mockJwtWithRole("SUPER_MANAGER");
            lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            InterventionResponse resultResponse = InterventionResponse.builder()
                    .id(1L).title("Test").status("PENDING")
                    .assignedToType("user").assignedToId(technician.getId())
                    .build();

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(userRepository.findById(technician.getId())).thenReturn(Optional.of(technician));
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToResponse(any())).thenReturn(resultResponse);

            InterventionResponse result = service.assign(1L, technician.getId(), null, jwt);

            assertThat(result.assignedToType()).isEqualTo("user");
            assertThat(result.assignedToId()).isEqualTo(technician.getId());

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            assertThat(captor.getValue().getAssignedUser()).isEqualTo(technician);
            assertThat(captor.getValue().getTeamId()).isNull();
        }

        @Test
        @DisplayName("assigns team and clears user")
        void whenTeamProvided_thenAssignsTeamAndClearsUser() {
            Jwt jwt = mockJwtWithRole("SUPER_MANAGER");
            lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            Team team = new Team();
            team.setId(5L);
            team.setName("Team Nettoyage");

            InterventionResponse resultResponse = InterventionResponse.builder()
                    .id(1L).title("Test").status("PENDING")
                    .assignedToType("team").assignedToId(5L)
                    .build();

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(teamRepository.findById(5L)).thenReturn(Optional.of(team));
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToResponse(any())).thenReturn(resultResponse);

            InterventionResponse result = service.assign(1L, null, 5L, jwt);

            assertThat(result.assignedToType()).isEqualTo("team");

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            assertThat(captor.getValue().getTeamId()).isEqualTo(5L);
            assertThat(captor.getValue().getAssignedUser()).isNull();
        }

        @Test
        @DisplayName("non-platform staff cannot assign - throws UnauthorizedException")
        void whenNonPlatformStaff_thenThrowsUnauthorized() {
            Jwt jwt = mockJwtWithRole("HOST");
            lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            assertThatThrownBy(() -> service.assign(1L, 20L, null, jwt))
                    .isInstanceOf(UnauthorizedException.class);
        }
    }

    @Nested
    @DisplayName("InterventionStatus.assertCanTransitionTo (C3)")
    class AssertCanTransitionTo {

        @Test
        @DisplayName("valid transition does not throw")
        void whenValidTransition_thenNoException() {
            InterventionStatus.PENDING.assertCanTransitionTo(InterventionStatus.IN_PROGRESS);
            InterventionStatus.IN_PROGRESS.assertCanTransitionTo(InterventionStatus.COMPLETED);
            InterventionStatus.COMPLETED.assertCanTransitionTo(InterventionStatus.IN_PROGRESS);
        }

        @Test
        @DisplayName("invalid transition throws IllegalStateException with descriptive message")
        void whenInvalidTransition_thenThrowsWithMessage() {
            assertThatThrownBy(() -> InterventionStatus.CANCELLED.assertCanTransitionTo(InterventionStatus.IN_PROGRESS))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Transition invalide")
                    .hasMessageContaining("CANCELLED")
                    .hasMessageContaining("IN_PROGRESS");
        }

        @Test
        @DisplayName("PENDING cannot transition to COMPLETED directly")
        void whenPendingToCompleted_thenThrows() {
            assertThatThrownBy(() -> InterventionStatus.PENDING.assertCanTransitionTo(InterventionStatus.COMPLETED))
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    // ===== listWithRoleBasedAccess =====

    @Nested
    @DisplayName("listWithRoleBasedAccess")
    class ListWithRoleBasedAccess {

        @Test
        @DisplayName("when orgId null, returns empty page")
        void whenOrgIdNull_thenReturnsEmpty() {
            org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(0, 10);
            when(tenantContext.getOrganizationId()).thenReturn(null);

            org.springframework.data.domain.Page<InterventionResponse> result =
                    service.listWithRoleBasedAccess(pageable, null, null, null, null, null, null, mockJwtWithRole("SUPER_ADMIN"));

            assertThat(result.getContent()).isEmpty();
        }

        @Test
        @DisplayName("when invalid status, returns empty")
        void whenInvalidStatus_thenReturnsEmpty() {
            org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(0, 10);
            when(tenantContext.getOrganizationId()).thenReturn(1L);

            org.springframework.data.domain.Page<InterventionResponse> result =
                    service.listWithRoleBasedAccess(pageable, null, null, "INVALID_STATUS", null, null, null,
                            mockJwtWithRole("SUPER_ADMIN"));

            assertThat(result.getContent()).isEmpty();
        }

        @Test
        @DisplayName("SUPER_ADMIN uses findByFiltersWithRelations")
        void whenSuperAdmin_thenUsesGeneralQuery() {
            org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(0, 10);
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            org.springframework.data.domain.Page<Intervention> page =
                    new org.springframework.data.domain.PageImpl<>(List.of());
            when(interventionRepository.findByFiltersWithRelations(
                    any(), any(), any(), any(), any(), any(), any(), any()))
                    .thenReturn(page);

            org.springframework.data.domain.Page<InterventionResponse> result =
                    service.listWithRoleBasedAccess(pageable, null, null, null, null, null, null,
                            mockJwtWithRole("SUPER_ADMIN"));

            assertThat(result.getContent()).isEmpty();
        }
    }

    // ===== addPhotos =====

    @Nested
    @DisplayName("addPhotos")
    class AddPhotos {

        @Test
        @DisplayName("when not IN_PROGRESS, throws")
        void whenNotInProgress_thenThrows() {
            Jwt jwt = mockJwtWithRole("HOST");
            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            assertThatThrownBy(() -> service.addPhotos(1L, List.of(), "before", jwt))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("when wrong photoType, throws")
        void whenWrongPhotoType_thenThrows() {
            Jwt jwt = mockJwtWithRole("HOST");
            Intervention intervention = buildIntervention(1L, InterventionStatus.IN_PROGRESS);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            assertThatThrownBy(() -> service.addPhotos(1L, List.of(), "wrong", jwt))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("when count > max, throws")
        void whenTooManyPhotos_thenThrows() {
            Jwt jwt = mockJwtWithRole("HOST");
            Intervention intervention = buildIntervention(1L, InterventionStatus.IN_PROGRESS);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(photoService.getPhotoCount(intervention)).thenReturn(20L);

            // Create 1 mock file -> currentCount 20 + 1 = 21 > 20
            org.springframework.web.multipart.MultipartFile mockFile =
                    mock(org.springframework.web.multipart.MultipartFile.class);

            assertThatThrownBy(() -> service.addPhotos(1L, List.of(mockFile), "before", jwt))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("when valid 'before' photo, calls savePhotos and reloads")
        void whenValidBeforePhoto_thenSaves() {
            Jwt jwt = mockJwtWithRole("HOST");
            Intervention intervention = buildIntervention(1L, InterventionStatus.IN_PROGRESS);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(photoService.getPhotoCount(intervention)).thenReturn(5L);

            InterventionResponse expectedResp = buildResultResponse(1L, "IN_PROGRESS", "Test");
            when(interventionMapper.convertToResponse(any())).thenReturn(expectedResp);

            org.springframework.web.multipart.MultipartFile mockFile =
                    mock(org.springframework.web.multipart.MultipartFile.class);

            InterventionResponse result = service.addPhotos(1L, List.of(mockFile), "before", jwt);

            assertThat(result).isNotNull();
            verify(photoService).savePhotos(any(), eq(List.of(mockFile)), eq("before"));
        }

        @Test
        @DisplayName("when 'after' photo type accepted")
        void whenAfterPhotoType_thenAccepted() {
            Jwt jwt = mockJwtWithRole("HOST");
            Intervention intervention = buildIntervention(1L, InterventionStatus.IN_PROGRESS);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(photoService.getPhotoCount(intervention)).thenReturn(0L);

            InterventionResponse expectedResp = buildResultResponse(1L, "IN_PROGRESS", "Test");
            when(interventionMapper.convertToResponse(any())).thenReturn(expectedResp);

            org.springframework.web.multipart.MultipartFile mockFile =
                    mock(org.springframework.web.multipart.MultipartFile.class);

            InterventionResponse result = service.addPhotos(1L, List.of(mockFile), "after", jwt);

            assertThat(result).isNotNull();
            verify(photoService).savePhotos(any(), eq(List.of(mockFile)), eq("after"));
        }

        @Test
        @DisplayName("when intervention not found, throws NotFoundException")
        void whenNotFound_thenThrows() {
            Jwt jwt = mockJwtWithRole("HOST");
            when(interventionRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.addPhotos(99L, List.of(), "before", jwt))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        @DisplayName("when savePhotos throws, wraps in RuntimeException")
        void whenSavePhotosThrows_thenWrapsException() {
            Jwt jwt = mockJwtWithRole("HOST");
            Intervention intervention = buildIntervention(1L, InterventionStatus.IN_PROGRESS);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(photoService.getPhotoCount(intervention)).thenReturn(0L);

            org.springframework.web.multipart.MultipartFile mockFile =
                    mock(org.springframework.web.multipart.MultipartFile.class);
            org.mockito.Mockito.doThrow(new RuntimeException("storage error"))
                    .when(photoService).savePhotos(any(), any(), any());

            assertThatThrownBy(() -> service.addPhotos(1L, List.of(mockFile), "before", jwt))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("storage error");
        }
    }

    // ====== EXTENDED COVERAGE ======

    @Nested
    @DisplayName("deletePhoto")
    class DeletePhoto {
        @Test
        @DisplayName("when intervention not found, throws")
        void whenNotFound_thenThrows() {
            Jwt jwt = mockJwtWithRole("HOST");
            when(interventionRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.deletePhoto(99L, 1L, jwt))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        @DisplayName("when intervention not IN_PROGRESS, throws")
        void whenNotInProgress_thenThrows() {
            Jwt jwt = mockJwtWithRole("HOST");
            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            assertThatThrownBy(() -> service.deletePhoto(1L, 5L, jwt))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("when valid, deletes via photoService and reloads")
        void whenValid_thenDeletes() {
            Jwt jwt = mockJwtWithRole("HOST");
            Intervention intervention = buildIntervention(1L, InterventionStatus.IN_PROGRESS);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            InterventionResponse expectedResp = buildResultResponse(1L, "IN_PROGRESS", "Test");
            when(interventionMapper.convertToResponse(any())).thenReturn(expectedResp);

            InterventionResponse result = service.deletePhoto(1L, 5L, jwt);

            verify(photoService).deletePhoto(5L, 1L);
            assertThat(result).isNotNull();
        }
    }

    @Nested
    @DisplayName("assign - notification side effects")
    class AssignNotifications {
        @Test
        @DisplayName("when assignedUser exists, notifies them")
        void whenUserAssigned_thenNotifies() {
            Jwt jwt = mockJwtWithRole("SUPER_MANAGER");
            lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(userRepository.findById(technician.getId())).thenReturn(Optional.of(technician));
            when(interventionRepository.save(any())).thenAnswer(inv -> {
                Intervention i = inv.getArgument(0);
                i.setAssignedUser(technician);
                return i;
            });
            InterventionResponse resp = buildResultResponse(1L, "PENDING", "Test");
            when(interventionMapper.convertToResponse(any())).thenReturn(resp);

            service.assign(1L, technician.getId(), null, jwt);

            verify(notificationService).notify(eq("tech-kc"), eq(NotificationKey.INTERVENTION_ASSIGNED_TO_USER),
                    any(), any(), any());
        }

        @Test
        @DisplayName("when neither userId nor teamId provided, just saves with no assignment changes")
        void whenNeither_thenJustSaves() {
            Jwt jwt = mockJwtWithRole("SUPER_MANAGER");
            lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            InterventionResponse resp = buildResultResponse(1L, "PENDING", "Test");
            when(interventionMapper.convertToResponse(any())).thenReturn(resp);

            InterventionResponse result = service.assign(1L, null, null, jwt);

            assertThat(result).isNotNull();
            verify(interventionRepository).save(intervention);
        }

        @Test
        @DisplayName("when notification fails, does not propagate exception")
        void whenNotificationFails_thenSwallowed() {
            Jwt jwt = mockJwtWithRole("SUPER_MANAGER");
            lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(userRepository.findById(technician.getId())).thenReturn(Optional.of(technician));
            when(interventionRepository.save(any())).thenAnswer(inv -> {
                Intervention i = inv.getArgument(0);
                i.setAssignedUser(technician);
                return i;
            });
            InterventionResponse resp = buildResultResponse(1L, "PENDING", "Test");
            when(interventionMapper.convertToResponse(any())).thenReturn(resp);
            org.mockito.Mockito.doThrow(new RuntimeException("notif down"))
                    .when(notificationService).notify(any(), any(), any(), any(), any());

            // Should not propagate
            InterventionResponse result = service.assign(1L, technician.getId(), null, jwt);
            assertThat(result).isNotNull();
        }

        @Test
        @DisplayName("when user not found, throws NotFoundException")
        void whenUserNotFound_thenThrows() {
            Jwt jwt = mockJwtWithRole("SUPER_MANAGER");
            lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(userRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.assign(1L, 999L, null, jwt))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        @DisplayName("when team not found, throws NotFoundException")
        void whenTeamNotFound_thenThrows() {
            Jwt jwt = mockJwtWithRole("SUPER_MANAGER");
            lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(teamRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.assign(1L, null, 999L, jwt))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("create - notification side effects")
    class CreateNotifications {
        @Test
        @DisplayName("HOST sends AWAITING_VALIDATION notification")
        void hostCreate_sendsAwaitingValidation() {
            Jwt jwt = mockJwtWithRole("HOST");
            CreateInterventionRequest request = buildCreateRequest();

            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(interventionRepository.save(any(Intervention.class))).thenAnswer(inv -> {
                Intervention saved = inv.getArgument(0);
                saved.setId(1L);
                saved.setProperty(property);
                return saved;
            });
            InterventionResponse resp = buildResultResponse(1L, "AWAITING_VALIDATION", "Reparation fuite");
            when(interventionMapper.convertToResponse(any())).thenReturn(resp);

            service.create(request, jwt);

            verify(notificationService).notifyAdminsAndManagers(
                    eq(NotificationKey.INTERVENTION_AWAITING_VALIDATION), any(), any(), any());
        }

        @Test
        @DisplayName("platform staff sends INTERVENTION_CREATED notification")
        void platformStaffCreate_sendsCreated() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            CreateInterventionRequest request = buildCreateRequest();

            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(interventionRepository.save(any(Intervention.class))).thenAnswer(inv -> {
                Intervention saved = inv.getArgument(0);
                saved.setId(1L);
                saved.setProperty(property);
                return saved;
            });
            InterventionResponse resp = buildResultResponse(1L, "PENDING", "Reparation fuite");
            when(interventionMapper.convertToResponse(any())).thenReturn(resp);

            service.create(request, jwt);

            verify(notificationService).notifyAdminsAndManagers(
                    eq(NotificationKey.INTERVENTION_CREATED), any(), any(), any());
        }
    }

    @Nested
    @DisplayName("delete - notification side effect")
    class DeleteNotifications {
        @Test
        @DisplayName("when admin deletes, sends INTERVENTION_DELETED notification")
        void whenAdminDeletes_thenNotifies() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            service.delete(1L, jwt);

            verify(notificationService).notify(eq("owner-kc"), eq(NotificationKey.INTERVENTION_DELETED),
                    any(), any(), any());
        }
    }

    @Nested
    @DisplayName("listWithRoleBasedAccess - operational roles")
    class ListOperationalRoles {
        @Test
        @DisplayName("when TECHNICIAN and user not found, returns empty page")
        void whenTechnicianUserNotFound_thenEmpty() {
            org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(0, 10);
            when(tenantContext.getOrganizationId()).thenReturn(1L);

            Jwt jwt = mockJwtWithRole("TECHNICIAN");
            when(jwt.getSubject()).thenReturn("tech-kc");
            when(userRepository.findByKeycloakId("tech-kc")).thenReturn(Optional.empty());

            org.springframework.data.domain.Page<InterventionResponse> result =
                    service.listWithRoleBasedAccess(pageable, null, null, null, null, null, null, jwt);

            assertThat(result.getContent()).isEmpty();
        }

        @Test
        @DisplayName("when valid status PENDING string, uses filter")
        void whenStatusValid_thenUsesFilter() {
            org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(0, 10);
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            org.springframework.data.domain.Page<Intervention> page =
                    new org.springframework.data.domain.PageImpl<>(List.of());
            when(interventionRepository.findByFiltersWithRelations(
                    any(), any(), any(), any(), any(), any(), any(), any()))
                    .thenReturn(page);

            org.springframework.data.domain.Page<InterventionResponse> result =
                    service.listWithRoleBasedAccess(pageable, null, null, "PENDING", null, null, null,
                            mockJwtWithRole("SUPER_ADMIN"));

            assertThat(result.getContent()).isEmpty();
        }

        @Test
        @DisplayName("when invalid startDate, ignores and continues")
        void whenInvalidStartDate_thenIgnoresAndContinues() {
            org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(0, 10);
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            org.springframework.data.domain.Page<Intervention> page =
                    new org.springframework.data.domain.PageImpl<>(List.of());
            when(interventionRepository.findByFiltersWithRelations(
                    any(), any(), any(), any(), any(), any(), any(), any()))
                    .thenReturn(page);

            // invalid date string -> parsing throws -> caught and treated as null
            org.springframework.data.domain.Page<InterventionResponse> result =
                    service.listWithRoleBasedAccess(pageable, null, null, null, null,
                            "not-a-date", "2026-12-31", mockJwtWithRole("SUPER_ADMIN"));

            assertThat(result.getContent()).isEmpty();
        }
    }

    @Nested
    @DisplayName("getById - exception propagation")
    class GetByIdExceptions {
        @Test
        @DisplayName("when accessPolicy throws UnauthorizedException, propagates")
        void whenUnauthorized_thenPropagates() {
            Jwt jwt = mockJwtWithRole("HOST");
            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            org.mockito.Mockito.doThrow(new UnauthorizedException("denied"))
                    .when(accessPolicy).assertCanAccess(intervention, jwt);

            assertThatThrownBy(() -> service.getById(1L, jwt))
                    .isInstanceOf(UnauthorizedException.class);
        }
    }
}
