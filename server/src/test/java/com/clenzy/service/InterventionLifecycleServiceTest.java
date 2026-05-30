package com.clenzy.service;

import com.clenzy.dto.InterventionResponse;
import com.clenzy.exception.NotFoundException;
import com.clenzy.exception.UnauthorizedException;
import com.clenzy.model.*;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InterventionLifecycleServiceTest {

    @Mock private InterventionRepository interventionRepository;
    @Mock private InterventionMapper interventionMapper;
    @Mock private InterventionAccessPolicy accessPolicy;
    @Mock private NotificationService notificationService;
    @Mock private OutboxPublisher outboxPublisher;
    @Mock private ObjectMapper objectMapper;
    @Mock private TenantContext tenantContext;

    private InterventionLifecycleService service;

    private Property property;
    private User owner;

    @BeforeEach
    void setUp() {
        service = new InterventionLifecycleService(
                interventionRepository, interventionMapper, accessPolicy,
                notificationService, outboxPublisher, objectMapper, tenantContext);

        owner = new User();
        owner.setId(10L);
        owner.setKeycloakId("owner-kc");
        owner.setFirstName("Jean");
        owner.setLastName("Dupont");
        owner.setEmail("jean@example.com");

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

    private InterventionResponse buildResultResponse(Long id, String status, String title) {
        return InterventionResponse.builder()
                .id(id).title(title).status(status)
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
    @DisplayName("updateStatus(id, status, jwt)")
    class UpdateStatus {

        @Test
        @DisplayName("valid transition PENDING -> IN_PROGRESS succeeds")
        void whenValidTransition_thenSucceeds() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            InterventionResponse resultResponse = buildResultResponse(1L, "IN_PROGRESS", "Test Intervention");

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any(Intervention.class))).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToResponse(any(Intervention.class))).thenReturn(resultResponse);

            InterventionResponse result = service.updateStatus(1L, "IN_PROGRESS", jwt);

            assertThat(result.status()).isEqualTo("IN_PROGRESS");
            verify(interventionRepository).save(any(Intervention.class));
        }

        @Test
        @DisplayName("invalid transition CANCELLED -> IN_PROGRESS throws IllegalStateException")
        void whenInvalidTransition_thenThrows() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");

            Intervention intervention = buildIntervention(1L, InterventionStatus.CANCELLED);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            assertThatThrownBy(() -> service.updateStatus(1L, "IN_PROGRESS", jwt))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Transition invalide");
        }

        @Test
        @DisplayName("when intervention not found - throws NotFoundException")
        void whenNotFound_thenThrowsNotFoundException() {
            Jwt jwt = mock(Jwt.class);
            when(interventionRepository.findById(999L)).thenReturn(Optional.empty());

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
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            InterventionResponse resultResponse = buildResultResponse(1L, "IN_PROGRESS", "Test Intervention");

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any(Intervention.class))).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToResponse(any(Intervention.class))).thenReturn(resultResponse);

            InterventionResponse result = service.startIntervention(1L, jwt);

            assertThat(result.status()).isEqualTo("IN_PROGRESS");

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus()).isEqualTo(InterventionStatus.IN_PROGRESS);
            assertThat(captor.getValue().getStartTime()).isNotNull();
        }

        @Test
        @DisplayName("completed intervention cannot be started - throws IllegalStateException")
        void whenCompleted_thenThrowsIllegalState() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");

            Intervention intervention = buildIntervention(1L, InterventionStatus.COMPLETED);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            assertThatThrownBy(() -> service.startIntervention(1L, jwt))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("COMPLETED");
        }

        @Test
        @DisplayName("cancelled intervention cannot be started - throws IllegalStateException")
        void whenCancelled_thenThrowsIllegalState() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");

            Intervention intervention = buildIntervention(1L, InterventionStatus.CANCELLED);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            assertThatThrownBy(() -> service.startIntervention(1L, jwt))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("CANCELLED");
        }

        @Test
        @DisplayName("publishes Kafka BON_INTERVENTION event")
        void whenStarted_thenPublishesKafkaEvent() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToResponse(any())).thenReturn(buildResultResponse(1L, "IN_PROGRESS", "Test"));

            service.startIntervention(1L, jwt);

            verify(outboxPublisher).publish(eq("INTERVENTION"), eq("1"), eq("BON_INTERVENTION"),
                    anyString(), contains("bon-intervention"), any(), any());
        }
    }

    @Nested
    @DisplayName("reopenIntervention(id, jwt)")
    class ReopenIntervention {

        @Test
        @DisplayName("completed intervention is reopened to IN_PROGRESS")
        void whenCompleted_thenReopensToInProgress() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");

            Intervention intervention = buildIntervention(1L, InterventionStatus.COMPLETED);
            intervention.setProgressPercentage(100);
            intervention.setCompletedSteps(null);

            InterventionResponse resultResponse = buildResultResponse(1L, "IN_PROGRESS", "Test Intervention");

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any(Intervention.class))).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToResponse(any(Intervention.class))).thenReturn(resultResponse);

            InterventionResponse result = service.reopenIntervention(1L, jwt);

            assertThat(result.status()).isEqualTo("IN_PROGRESS");

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus()).isEqualTo(InterventionStatus.IN_PROGRESS);
        }

        @Test
        @DisplayName("non-completed intervention cannot be reopened - throws IllegalStateException")
        void whenNotCompleted_thenThrowsIllegalState() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");

            Intervention intervention = buildIntervention(1L, InterventionStatus.IN_PROGRESS);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            assertThatThrownBy(() -> service.reopenIntervention(1L, jwt))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        @DisplayName("progress is recalculated on reopen when no completed steps")
        void whenReopened_thenProgressRecalculated() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");

            Intervention intervention = buildIntervention(1L, InterventionStatus.COMPLETED);
            intervention.setProgressPercentage(100);
            intervention.setCompletedSteps(null);

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToResponse(any())).thenReturn(buildResultResponse(1L, "IN_PROGRESS", "Test"));

            service.reopenIntervention(1L, jwt);

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            assertThat(captor.getValue().getProgressPercentage()).isLessThan(100);
        }
    }

    @Nested
    @DisplayName("validateIntervention(id, cost, jwt)")
    class ValidateIntervention {

        @Test
        @DisplayName("sets estimated cost and changes status to AWAITING_PAYMENT")
        void whenAwaitingValidation_thenSetsCostandStatus() {
            Jwt jwt = mockJwtWithRole("SUPER_MANAGER");

            Intervention intervention = buildIntervention(1L, InterventionStatus.AWAITING_VALIDATION);
            BigDecimal cost = BigDecimal.valueOf(250);

            InterventionResponse resultResponse = InterventionResponse.builder()
                    .id(1L).title("Test").status("AWAITING_PAYMENT")
                    .estimatedCost(cost).build();

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToResponse(any())).thenReturn(resultResponse);

            InterventionResponse result = service.validateIntervention(1L, cost, jwt);

            assertThat(result.status()).isEqualTo("AWAITING_PAYMENT");
            assertThat(result.estimatedCost()).isEqualByComparingTo("250");

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            assertThat(captor.getValue().getEstimatedCost()).isEqualByComparingTo("250");
            assertThat(captor.getValue().getStatus()).isEqualTo(InterventionStatus.AWAITING_PAYMENT);
        }

        @Test
        @DisplayName("when not AWAITING_VALIDATION - throws IllegalStateException via state machine")
        void whenWrongStatus_thenThrows() {
            Jwt jwt = mockJwtWithRole("SUPER_MANAGER");

            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            assertThatThrownBy(() -> service.validateIntervention(1L, BigDecimal.TEN, jwt))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Transition invalide");
        }

        @Test
        @DisplayName("non-platform staff cannot validate - throws UnauthorizedException")
        void whenNonPlatformStaff_thenThrowsUnauthorized() {
            Jwt jwt = mockJwtWithRole("HOST");
            Intervention intervention = buildIntervention(1L, InterventionStatus.AWAITING_VALIDATION);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            assertThatThrownBy(() -> service.validateIntervention(1L, BigDecimal.TEN, jwt))
                    .isInstanceOf(UnauthorizedException.class);
        }

        @Test
        @DisplayName("when not found - throws NotFoundException")
        void whenNotFound_thenThrowsNotFoundException() {
            Jwt jwt = mock(Jwt.class);
            when(interventionRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.validateIntervention(999L, BigDecimal.TEN, jwt))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("completeIntervention - idempotency guard (C1)")
    class CompleteInterventionIdempotency {

        @Test
        @DisplayName("already COMPLETED returns response without side effects")
        void whenAlreadyCompleted_thenReturnsResponseWithoutSideEffects() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");

            Intervention intervention = buildIntervention(1L, InterventionStatus.COMPLETED);
            InterventionResponse resultResponse = buildResultResponse(1L, "COMPLETED", "Test");

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionMapper.convertToResponse(intervention)).thenReturn(resultResponse);

            InterventionResponse result = service.completeIntervention(1L, jwt);

            assertThat(result.status()).isEqualTo("COMPLETED");
            verify(interventionRepository, never()).save(any());
            verify(outboxPublisher, never()).publish(anyString(), anyString(), anyString(),
                    anyString(), anyString(), anyString(), any());
        }
    }

    // ============= EXTENDED =============

    @Nested
    @DisplayName("completeIntervention - full flow")
    class CompleteInterventionFullFlow {
        @Test
        @DisplayName("IN_PROGRESS -> COMPLETED, persists + outbox events")
        void whenInProgress_thenCompletesPublishesOutbox() throws Exception {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            Intervention intervention = buildIntervention(1L, InterventionStatus.IN_PROGRESS);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToResponse(any())).thenReturn(buildResultResponse(1L, "COMPLETED", "T"));
            when(objectMapper.writeValueAsString(any())).thenReturn("{}");

            service.completeIntervention(1L, jwt);

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus()).isEqualTo(InterventionStatus.COMPLETED);
            assertThat(captor.getValue().getProgressPercentage()).isEqualTo(100);
            assertThat(captor.getValue().getCompletedAt()).isNotNull();
            // Outbox event for host
            verify(outboxPublisher).publish(eq("INTERVENTION"), eq("1"), eq("VALIDATION_FIN_MISSION_HOST"),
                    anyString(), anyString(), any(), any());
        }

        @Test
        @DisplayName("when not found - throws NotFoundException")
        void whenNotFound_thenThrowsNotFound() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            when(interventionRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.completeIntervention(999L, jwt))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        @DisplayName("when not transitionable - throws IllegalStateException")
        void whenNotTransitionable_thenThrows() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            Intervention intervention = buildIntervention(1L, InterventionStatus.CANCELLED);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            assertThatThrownBy(() -> service.completeIntervention(1L, jwt))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        @DisplayName("tech with different email -> two outbox events")
        void whenTechDifferentFromHost_thenTwoEvents() throws Exception {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            Intervention intervention = buildIntervention(1L, InterventionStatus.IN_PROGRESS);

            com.clenzy.model.User tech = new com.clenzy.model.User();
            tech.setEmail("tech@example.com");
            intervention.setAssignedUser(tech);

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToResponse(any())).thenReturn(buildResultResponse(1L, "COMPLETED", "T"));
            when(objectMapper.writeValueAsString(any())).thenReturn("{}");

            service.completeIntervention(1L, jwt);

            verify(outboxPublisher).publish(any(), any(), eq("VALIDATION_FIN_MISSION_HOST"), any(), any(), any(), any());
            verify(outboxPublisher).publish(any(), any(), eq("VALIDATION_FIN_MISSION_TECH"), any(), any(), any(), any());
        }
    }

    @Nested
    @DisplayName("startIntervention - scheduledDate")
    class StartInterventionScheduled {
        @Test
        void whenBeforeScheduledDate_thenThrows() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            intervention.setScheduledDate(java.time.LocalDateTime.now().plusHours(1));
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            assertThatThrownBy(() -> service.startIntervention(1L, jwt))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("avant la date planifiee");
        }

        @Test
        void whenScheduledDatePast_thenStarts() throws Exception {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            intervention.setScheduledDate(java.time.LocalDateTime.now().minusHours(1));
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToResponse(any())).thenReturn(buildResultResponse(1L, "IN_PROGRESS", "T"));
            when(objectMapper.writeValueAsString(any())).thenReturn("{}");

            service.startIntervention(1L, jwt);

            verify(interventionRepository).save(any());
        }
    }

    @Nested
    @DisplayName("updateStatus - cancel auth")
    class UpdateStatusCancel {
        @Test
        @DisplayName("non-platform staff cannot cancel - throws AccessDenied")
        void whenNonPlatformCancels_thenAccessDenied() {
            Jwt jwt = mockJwtWithRole("HOST");
            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            assertThatThrownBy(() -> service.updateStatus(1L, "CANCELLED", jwt))
                    .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        }

        @Test
        @DisplayName("admin can cancel from PENDING")
        void whenAdminCancels_thenSucceeds() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            Intervention intervention = buildIntervention(1L, InterventionStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToResponse(any())).thenReturn(buildResultResponse(1L, "CANCELLED", "T"));

            service.updateStatus(1L, "CANCELLED", jwt);

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus()).isEqualTo(InterventionStatus.CANCELLED);
        }
    }

    @Nested
    @DisplayName("validateIntervention - cost validation")
    class ValidateInterventionCost {
        @Test
        void whenCostNull_thenIllegalArgument() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            Intervention intervention = buildIntervention(1L, InterventionStatus.AWAITING_VALIDATION);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            assertThatThrownBy(() -> service.validateIntervention(1L, null, jwt))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void whenCostNegative_thenIllegalArgument() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            Intervention intervention = buildIntervention(1L, InterventionStatus.AWAITING_VALIDATION);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            assertThatThrownBy(() -> service.validateIntervention(1L, BigDecimal.valueOf(-1), jwt))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    @DisplayName("reopenIntervention - completedSteps handling")
    class ReopenCompletedSteps {
        @Test
        void whenCompletedStepsValid_removesAfterPhotos() throws Exception {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            Intervention intervention = buildIntervention(1L, InterventionStatus.COMPLETED);
            intervention.setCompletedSteps("[\"before_photos\",\"after_photos\"]");
            intervention.setProgressPercentage(100);

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToResponse(any())).thenReturn(buildResultResponse(1L, "IN_PROGRESS", "T"));
            when(objectMapper.readValue(eq("[\"before_photos\",\"after_photos\"]"),
                    any(com.fasterxml.jackson.core.type.TypeReference.class)))
                .thenReturn(new java.util.ArrayList<>(java.util.List.of("before_photos", "after_photos")));
            when(objectMapper.writeValueAsString(any())).thenReturn("[\"before_photos\"]");

            service.reopenIntervention(1L, jwt);

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            assertThat(captor.getValue().getProgressPercentage()).isLessThan(100);
        }

        @Test
        void whenCompletedStepsInvalidJson_resetToEmpty() throws Exception {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            Intervention intervention = buildIntervention(1L, InterventionStatus.COMPLETED);
            intervention.setCompletedSteps("not-json");

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToResponse(any())).thenReturn(buildResultResponse(1L, "IN_PROGRESS", "T"));
            when(objectMapper.readValue(anyString(), any(com.fasterxml.jackson.core.type.TypeReference.class)))
                .thenThrow(new com.fasterxml.jackson.core.JsonProcessingException("bad") {});

            service.reopenIntervention(1L, jwt);

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            assertThat(captor.getValue().getCompletedSteps()).isEqualTo("[]");
        }
    }
}
