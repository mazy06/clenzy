package com.clenzy.service;

import com.clenzy.dto.InterventionDto;
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
import org.springframework.kafka.core.KafkaTemplate;
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
    @Mock private KafkaTemplate<String, Object> kafkaTemplate;
    @Mock private TenantContext tenantContext;
    @Mock private InterventionPhotoService photoService;
    @Mock private InterventionMapper interventionMapper;

    private InterventionService service;

    private Property property;
    private User owner;
    private User technician;

    @BeforeEach
    void setUp() {
        service = new InterventionService(
                interventionRepository, userRepository, teamRepository,
                notificationService, kafkaTemplate, tenantContext,
                photoService, interventionMapper);

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

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Jwt mockJwtWithRole(String role) {
        Jwt jwt = mock(Jwt.class);
        when(jwt.getClaim("realm_access")).thenReturn(Map.of("roles", List.of(role)));
        lenient().when(jwt.getSubject()).thenReturn("test-kc");
        return jwt;
    }

    private Jwt mockJwtWithRole(String role, String subject) {
        Jwt jwt = mock(Jwt.class);
        when(jwt.getClaim("realm_access")).thenReturn(Map.of("roles", List.of(role)));
        lenient().when(jwt.getSubject()).thenReturn(subject);
        return jwt;
    }

    private InterventionDto buildCreateDto() {
        InterventionDto dto = new InterventionDto();
        dto.title = "Reparation fuite";
        dto.description = "Fuite robinet cuisine";
        dto.type = "PLUMBING";
        dto.priority = "HIGH";
        dto.propertyId = property.getId();
        dto.requestorId = owner.getId();
        dto.scheduledDate = "2026-03-01T10:00:00";
        return dto;
    }

    private InterventionDto buildResultDto(Long id, String status, String title) {
        InterventionDto result = new InterventionDto();
        result.id = id;
        result.title = title;
        result.status = status;
        result.propertyName = "Appartement Paris";
        return result;
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

    // ── Tests ────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("create(dto, jwt)")
    class Create {

        @Test
        @DisplayName("HOST user creates intervention with AWAITING_VALIDATION status")
        void whenHostCreates_thenStatusIsAwaitingValidation() {
            // Arrange
            Jwt jwt = mockJwtWithRole("HOST");
            InterventionDto dto = buildCreateDto();
            dto.estimatedCost = BigDecimal.valueOf(200);

            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(interventionRepository.save(any(Intervention.class))).thenAnswer(inv -> {
                Intervention saved = inv.getArgument(0);
                saved.setId(1L);
                return saved;
            });

            InterventionDto resultDto = buildResultDto(1L, "AWAITING_VALIDATION", "Reparation fuite");
            resultDto.estimatedCost = null;
            when(interventionMapper.convertToDto(any(Intervention.class))).thenReturn(resultDto);

            // Act
            InterventionDto result = service.create(dto, jwt);

            // Assert
            assertThat(result.status).isEqualTo("AWAITING_VALIDATION");
            assertThat(result.estimatedCost).isNull();
            verify(interventionMapper).apply(eq(dto), any(Intervention.class));
            verify(interventionRepository).save(any(Intervention.class));
        }

        @Test
        @DisplayName("platform staff creates intervention with PENDING status")
        void whenPlatformStaffCreates_thenStatusIsPending() {
            // Arrange
            Jwt jwt = mockJwtWithRole("SUPER_MANAGER");
            InterventionDto dto = buildCreateDto();

            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(interventionRepository.save(any(Intervention.class))).thenAnswer(inv -> {
                Intervention saved = inv.getArgument(0);
                saved.setId(1L);
                return saved;
            });

            InterventionDto resultDto = buildResultDto(1L, "PENDING", "Reparation fuite");
            when(interventionMapper.convertToDto(any(Intervention.class))).thenReturn(resultDto);

            // Act
            InterventionDto result = service.create(dto, jwt);

            // Assert
            assertThat(result.status).isEqualTo("PENDING");
            verify(interventionRepository).save(any(Intervention.class));
        }

        @Test
        @DisplayName("unauthorized role throws UnauthorizedException")
        void whenUnauthorizedRole_thenThrows() {
            // Arrange
            Jwt jwt = mockJwtWithRole("TECHNICIAN");
            InterventionDto dto = buildCreateDto();

            // Act & Assert
            assertThatThrownBy(() -> service.create(dto, jwt))
                    .isInstanceOf(UnauthorizedException.class);
        }
    }

    @Nested
    @DisplayName("update(id, dto, jwt)")
    class Update {

        @Test
        @DisplayName("when found and authorized - applies changes and saves")
        void whenFoundAndAuthorized_thenUpdatesAndReturnsDto() {
            // Arrange
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            InterventionDto updateDto = new InterventionDto();
            updateDto.title = "Updated Title";
            updateDto.priority = "CRITICAL";

            InterventionDto resultDto = buildResultDto(1L, "PENDING", "Updated Title");

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any(Intervention.class))).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToDto(any(Intervention.class))).thenReturn(resultDto);

            // Act
            InterventionDto result = service.update(1L, updateDto, jwt);

            // Assert
            assertThat(result.title).isEqualTo("Updated Title");
            verify(interventionMapper).apply(eq(updateDto), eq(intervention));
            verify(interventionRepository).save(intervention);
        }

        @Test
        @DisplayName("when not found - throws NotFoundException")
        void whenNotFound_thenThrowsNotFoundException() {
            // Arrange
            Jwt jwt = mock(Jwt.class);
            when(interventionRepository.findById(999L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.update(999L, new InterventionDto(), jwt))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("getById(id, jwt)")
    class GetById {

        @Test
        @DisplayName("when found and authorized - returns DTO")
        void whenFoundAndAuthorized_thenReturnsDto() {
            // Arrange
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            InterventionDto resultDto = buildResultDto(1L, "PENDING", "Test Intervention");

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionMapper.convertToDto(intervention)).thenReturn(resultDto);

            // Act
            InterventionDto result = service.getById(1L, jwt);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.id).isEqualTo(1L);
            assertThat(result.title).isEqualTo("Test Intervention");
        }

        @Test
        @DisplayName("when not found - throws NotFoundException")
        void whenNotFound_thenThrowsNotFoundException() {
            // Arrange
            Jwt jwt = mock(Jwt.class);
            when(interventionRepository.findById(999L)).thenReturn(Optional.empty());

            // Act & Assert
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
            // Arrange
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            // Act
            service.delete(1L, jwt);

            // Assert
            verify(interventionRepository).deleteById(1L);
        }

        @Test
        @DisplayName("non-admin throws UnauthorizedException")
        void whenNonAdmin_thenThrowsUnauthorized() {
            // Arrange
            Jwt jwt = mockJwtWithRole("SUPER_MANAGER");
            lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            // Act & Assert
            assertThatThrownBy(() -> service.delete(1L, jwt))
                    .isInstanceOf(UnauthorizedException.class);
        }

        @Test
        @DisplayName("when not found - throws NotFoundException")
        void whenNotFound_thenThrowsNotFoundException() {
            // Arrange
            Jwt jwt = mock(Jwt.class);
            when(interventionRepository.findById(999L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.delete(999L, jwt))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("updateStatus(id, status, jwt)")
    class UpdateStatus {

        @Test
        @DisplayName("valid transition PENDING -> IN_PROGRESS succeeds")
        void whenValidTransition_thenSucceeds() {
            // Arrange
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            InterventionDto resultDto = buildResultDto(1L, "IN_PROGRESS", "Test Intervention");

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any(Intervention.class))).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToDto(any(Intervention.class))).thenReturn(resultDto);

            // Act
            InterventionDto result = service.updateStatus(1L, "IN_PROGRESS", jwt);

            // Assert
            assertThat(result.status).isEqualTo("IN_PROGRESS");
            verify(interventionRepository).save(any(Intervention.class));
        }

        @Test
        @DisplayName("invalid transition CANCELLED -> IN_PROGRESS throws IllegalStateException")
        void whenInvalidTransition_thenThrows() {
            // Arrange
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.CANCELLED);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            // Act & Assert
            assertThatThrownBy(() -> service.updateStatus(1L, "IN_PROGRESS", jwt))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Transition invalide");
        }

        @Test
        @DisplayName("when intervention not found - throws NotFoundException")
        void whenNotFound_thenThrowsNotFoundException() {
            // Arrange
            Jwt jwt = mock(Jwt.class);
            when(interventionRepository.findById(999L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.updateStatus(999L, "IN_PROGRESS", jwt))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("startIntervention(id, jwt)")
    class StartIntervention {

        @Test
        @DisplayName("changes status to IN_PROGRESS and sets startTime")
        void whenPending_thenChangesToInProgress() {
            // Arrange
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            InterventionDto resultDto = buildResultDto(1L, "IN_PROGRESS", "Test Intervention");

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any(Intervention.class))).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToDto(any(Intervention.class))).thenReturn(resultDto);

            // Act
            InterventionDto result = service.startIntervention(1L, jwt);

            // Assert
            assertThat(result.status).isEqualTo("IN_PROGRESS");

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus()).isEqualTo(InterventionStatus.IN_PROGRESS);
            assertThat(captor.getValue().getStartTime()).isNotNull();
        }

        @Test
        @DisplayName("completed intervention cannot be started - throws IllegalStateException")
        void whenCompleted_thenThrowsIllegalState() {
            // Arrange
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.COMPLETED);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            // Act & Assert
            assertThatThrownBy(() -> service.startIntervention(1L, jwt))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("terminée");
        }

        @Test
        @DisplayName("cancelled intervention cannot be started - throws IllegalStateException")
        void whenCancelled_thenThrowsIllegalState() {
            // Arrange
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.CANCELLED);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            // Act & Assert
            assertThatThrownBy(() -> service.startIntervention(1L, jwt))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("annulée");
        }

        @Test
        @DisplayName("publishes Kafka BON_INTERVENTION event")
        void whenStarted_thenPublishesKafkaEvent() {
            // Arrange
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToDto(any())).thenReturn(buildResultDto(1L, "IN_PROGRESS", "Test"));

            // Act
            service.startIntervention(1L, jwt);

            // Assert
            verify(kafkaTemplate).send(anyString(), contains("bon-intervention"), any(Map.class));
        }
    }

    @Nested
    @DisplayName("reopenIntervention(id, jwt)")
    class ReopenIntervention {

        @Test
        @DisplayName("completed intervention is reopened to IN_PROGRESS")
        void whenCompleted_thenReopensToInProgress() {
            // Arrange
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.COMPLETED);
            intervention.setProgressPercentage(100);
            intervention.setCompletedSteps(null);

            InterventionDto resultDto = buildResultDto(1L, "IN_PROGRESS", "Test Intervention");

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any(Intervention.class))).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToDto(any(Intervention.class))).thenReturn(resultDto);

            // Act
            InterventionDto result = service.reopenIntervention(1L, jwt);

            // Assert
            assertThat(result.status).isEqualTo("IN_PROGRESS");

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus()).isEqualTo(InterventionStatus.IN_PROGRESS);
        }

        @Test
        @DisplayName("non-completed intervention cannot be reopened - throws IllegalStateException")
        void whenNotCompleted_thenThrowsIllegalState() {
            // Arrange
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.IN_PROGRESS);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            // Act & Assert
            assertThatThrownBy(() -> service.reopenIntervention(1L, jwt))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("terminées");
        }

        @Test
        @DisplayName("progress is recalculated on reopen when no completed steps")
        void whenReopened_thenProgressRecalculated() {
            // Arrange
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.COMPLETED);
            intervention.setProgressPercentage(100);
            intervention.setCompletedSteps(null);

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToDto(any())).thenReturn(buildResultDto(1L, "IN_PROGRESS", "Test"));

            // Act
            service.reopenIntervention(1L, jwt);

            // Assert
            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            assertThat(captor.getValue().getProgressPercentage()).isLessThan(100);
        }
    }

    @Nested
    @DisplayName("updateProgress(id, progressPercentage, jwt)")
    class UpdateProgress {

        @Test
        @DisplayName("sets progress percentage on intervention")
        void whenValid_thenSetsProgress() {
            // Arrange
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.IN_PROGRESS);
            InterventionDto resultDto = buildResultDto(1L, "IN_PROGRESS", "Test");
            resultDto.progressPercentage = 50;

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToDto(any())).thenReturn(resultDto);

            // Act
            InterventionDto result = service.updateProgress(1L, 50, jwt);

            // Assert
            assertThat(result.progressPercentage).isEqualTo(50);

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            assertThat(captor.getValue().getProgressPercentage()).isEqualTo(50);
        }

        @Test
        @DisplayName("100% progress marks intervention as COMPLETED with timestamp")
        void whenProgressIs100_thenMarksCompleted() {
            // Arrange
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.IN_PROGRESS);
            InterventionDto resultDto = buildResultDto(1L, "COMPLETED", "Test");

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToDto(any())).thenReturn(resultDto);

            // Act
            InterventionDto result = service.updateProgress(1L, 100, jwt);

            // Assert
            assertThat(result.status).isEqualTo("COMPLETED");

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus()).isEqualTo(InterventionStatus.COMPLETED);
            assertThat(captor.getValue().getCompletedAt()).isNotNull();
        }

        @Test
        @DisplayName("negative progress throws IllegalArgumentException")
        void whenNegative_thenThrows() {
            // Arrange
            Jwt jwt = mock(Jwt.class);

            // Act & Assert
            assertThatThrownBy(() -> service.updateProgress(1L, -5, jwt))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("progress above 100 throws IllegalArgumentException")
        void whenAbove100_thenThrows() {
            // Arrange
            Jwt jwt = mock(Jwt.class);

            // Act & Assert
            assertThatThrownBy(() -> service.updateProgress(1L, 150, jwt))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    @DisplayName("assign(id, userId, teamId, jwt)")
    class Assign {

        @Test
        @DisplayName("assigns user and clears team")
        void whenUserProvided_thenAssignsUserAndClearsTeam() {
            // Arrange
            Jwt jwt = mockJwtWithRole("SUPER_MANAGER");
            lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            InterventionDto resultDto = buildResultDto(1L, "PENDING", "Test");
            resultDto.assignedToType = "user";
            resultDto.assignedToId = technician.getId();

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(userRepository.findById(technician.getId())).thenReturn(Optional.of(technician));
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToDto(any())).thenReturn(resultDto);

            // Act
            InterventionDto result = service.assign(1L, technician.getId(), null, jwt);

            // Assert
            assertThat(result.assignedToType).isEqualTo("user");
            assertThat(result.assignedToId).isEqualTo(technician.getId());

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            assertThat(captor.getValue().getAssignedUser()).isEqualTo(technician);
            assertThat(captor.getValue().getTeamId()).isNull();
        }

        @Test
        @DisplayName("assigns team and clears user")
        void whenTeamProvided_thenAssignsTeamAndClearsUser() {
            // Arrange
            Jwt jwt = mockJwtWithRole("SUPER_MANAGER");
            lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            Team team = new Team();
            team.setId(5L);
            team.setName("Team Nettoyage");

            InterventionDto resultDto = buildResultDto(1L, "PENDING", "Test");
            resultDto.assignedToType = "team";
            resultDto.assignedToId = 5L;

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(teamRepository.findById(5L)).thenReturn(Optional.of(team));
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToDto(any())).thenReturn(resultDto);

            // Act
            InterventionDto result = service.assign(1L, null, 5L, jwt);

            // Assert
            assertThat(result.assignedToType).isEqualTo("team");

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            assertThat(captor.getValue().getTeamId()).isEqualTo(5L);
            assertThat(captor.getValue().getAssignedUser()).isNull();
        }

        @Test
        @DisplayName("non-platform staff cannot assign - throws UnauthorizedException")
        void whenNonPlatformStaff_thenThrowsUnauthorized() {
            // Arrange
            Jwt jwt = mockJwtWithRole("HOST");
            lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            // Act & Assert
            assertThatThrownBy(() -> service.assign(1L, 20L, null, jwt))
                    .isInstanceOf(UnauthorizedException.class);
        }
    }

    @Nested
    @DisplayName("validateIntervention(id, cost, jwt)")
    class ValidateIntervention {

        @Test
        @DisplayName("sets estimated cost and changes status to AWAITING_PAYMENT")
        void whenAwaitingValidation_thenSetsCostandStatus() {
            // Arrange
            Jwt jwt = mockJwtWithRole("SUPER_MANAGER");
            lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.AWAITING_VALIDATION);
            BigDecimal cost = BigDecimal.valueOf(250);

            InterventionDto resultDto = buildResultDto(1L, "AWAITING_PAYMENT", "Test");
            resultDto.estimatedCost = cost;

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToDto(any())).thenReturn(resultDto);

            // Act
            InterventionDto result = service.validateIntervention(1L, cost, jwt);

            // Assert
            assertThat(result.status).isEqualTo("AWAITING_PAYMENT");
            assertThat(result.estimatedCost).isEqualByComparingTo("250");

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            assertThat(captor.getValue().getEstimatedCost()).isEqualByComparingTo("250");
            assertThat(captor.getValue().getStatus()).isEqualTo(InterventionStatus.AWAITING_PAYMENT);
        }

        @Test
        @DisplayName("when not AWAITING_VALIDATION - throws RuntimeException")
        void whenWrongStatus_thenThrows() {
            // Arrange
            Jwt jwt = mockJwtWithRole("SUPER_MANAGER");
            lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            // Act & Assert
            assertThatThrownBy(() -> service.validateIntervention(1L, BigDecimal.TEN, jwt))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("pas en attente de validation");
        }

        @Test
        @DisplayName("non-platform staff cannot validate - throws UnauthorizedException")
        void whenNonPlatformStaff_thenThrowsUnauthorized() {
            // Arrange
            Jwt jwt = mockJwtWithRole("HOST");
            Intervention intervention = buildIntervention(1L, InterventionStatus.AWAITING_VALIDATION);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            // Act & Assert
            assertThatThrownBy(() -> service.validateIntervention(1L, BigDecimal.TEN, jwt))
                    .isInstanceOf(UnauthorizedException.class);
        }

        @Test
        @DisplayName("when not found - throws NotFoundException")
        void whenNotFound_thenThrowsNotFoundException() {
            // Arrange — plain mock: JWT is never inspected because NotFoundException fires first
            Jwt jwt = mock(Jwt.class);
            when(interventionRepository.findById(999L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.validateIntervention(999L, BigDecimal.TEN, jwt))
                    .isInstanceOf(NotFoundException.class);
        }
    }
}
