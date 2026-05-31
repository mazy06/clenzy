package com.clenzy.service;

import com.clenzy.dto.InterventionResponse;
import com.clenzy.model.*;
import com.clenzy.repository.InterventionRepository;
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

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InterventionProgressServiceTest {

    @Mock private InterventionRepository interventionRepository;
    @Mock private InterventionMapper interventionMapper;
    @Mock private InterventionAccessPolicy accessPolicy;
    @Mock private InterventionLifecycleService lifecycleService;
    @Mock private ObjectMapper objectMapper;

    private InterventionProgressService service;

    private Property property;
    private User owner;

    @BeforeEach
    void setUp() {
        service = new InterventionProgressService(
                interventionRepository, interventionMapper, accessPolicy,
                lifecycleService, objectMapper);

        owner = new User();
        owner.setId(10L);
        owner.setKeycloakId("owner-kc");
        owner.setEmail("jean@example.com");

        property = new Property();
        property.setId(100L);
        property.setName("Appartement Paris");
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
                .build();
    }

    private Intervention buildIntervention(Long id, InterventionStatus status) {
        Intervention intervention = new Intervention();
        intervention.setId(id);
        intervention.setOrganizationId(1L);
        intervention.setTitle("Test Intervention");
        intervention.setStatus(status);
        intervention.setProperty(property);
        return intervention;
    }

    @Nested
    @DisplayName("updateProgress(id, progressPercentage, jwt)")
    class UpdateProgress {

        @Test
        @DisplayName("sets progress percentage on intervention")
        void whenValid_thenSetsProgress() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");

            Intervention intervention = buildIntervention(1L, InterventionStatus.IN_PROGRESS);
            InterventionResponse resultResponse = InterventionResponse.builder()
                    .id(1L).title("Test").status("IN_PROGRESS").progressPercentage(50)
                    .build();

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToResponse(any())).thenReturn(resultResponse);

            InterventionResponse result = service.updateProgress(1L, 50, jwt);

            assertThat(result.progressPercentage()).isEqualTo(50);

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            assertThat(captor.getValue().getProgressPercentage()).isEqualTo(50);
        }

        @Test
        @DisplayName("100% progress saves without auto-completing (no delegation to lifecycle)")
        void whenProgressIs100_thenSavesWithoutAutoComplete() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");

            Intervention intervention = buildIntervention(1L, InterventionStatus.IN_PROGRESS);
            InterventionResponse resultResponse = buildResultResponse(1L, "IN_PROGRESS", "Test");

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(interventionRepository.save(any())).thenReturn(intervention);
            when(interventionMapper.convertToResponse(any())).thenReturn(resultResponse);

            InterventionResponse result = service.updateProgress(1L, 100, jwt);

            assertThat(result.status()).isEqualTo("IN_PROGRESS");
            verifyNoInteractions(lifecycleService);

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            assertThat(captor.getValue().getProgressPercentage()).isEqualTo(100);
        }

        @Test
        @DisplayName("negative progress throws IllegalArgumentException")
        void whenNegative_thenThrows() {
            Jwt jwt = mock(Jwt.class);

            assertThatThrownBy(() -> service.updateProgress(1L, -5, jwt))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("progress above 100 throws IllegalArgumentException")
        void whenAbove100_thenThrows() {
            Jwt jwt = mock(Jwt.class);

            assertThatThrownBy(() -> service.updateProgress(1L, 150, jwt))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    @DisplayName("Payload size validation (M4)")
    class PayloadSizeValidation {

        @Test
        @DisplayName("updateNotes rejects notes exceeding 10000 characters")
        void whenNotesTooLong_thenThrows() {
            Jwt jwt = mock(Jwt.class);
            String longNotes = "x".repeat(10_001);

            assertThatThrownBy(() -> service.updateNotes(1L, longNotes, jwt))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("10 000");
        }

        @Test
        @DisplayName("updateValidatedRooms rejects payload exceeding 10000 characters")
        void whenValidatedRoomsTooLong_thenThrows() {
            Jwt jwt = mock(Jwt.class);
            String longPayload = "x".repeat(10_001);

            assertThatThrownBy(() -> service.updateValidatedRooms(1L, longPayload, jwt))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("10 000");
        }

        @Test
        @DisplayName("updateCompletedSteps rejects payload exceeding 10000 characters")
        void whenCompletedStepsTooLong_thenThrows() {
            Jwt jwt = mock(Jwt.class);
            String longPayload = "x".repeat(10_001);

            assertThatThrownBy(() -> service.updateCompletedSteps(1L, longPayload, jwt))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("10 000");
        }
    }

    @Nested
    @DisplayName("updateProgress - error paths")
    class UpdateProgressErrors {

        @Test
        @DisplayName("throws NotFound when intervention missing")
        void whenInterventionNotFound_throwsNotFound() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            when(interventionRepository.findById(42L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.updateProgress(42L, 30, jwt))
                    .isInstanceOf(com.clenzy.exception.NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("updateNotes - happy path & errors")
    class UpdateNotes {

        @Test
        @DisplayName("updates notes when intervention is IN_PROGRESS")
        void whenInProgress_thenUpdates() throws Exception {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            Intervention iv = buildIntervention(1L, InterventionStatus.IN_PROGRESS);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(iv));
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToResponse(any()))
                    .thenReturn(buildResultResponse(1L, "IN_PROGRESS", "Test"));

            service.updateNotes(1L, "Some notes", jwt);

            ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(captor.capture());
            assertThat(captor.getValue().getNotes()).isEqualTo("Some notes");
        }

        @Test
        @DisplayName("rejects when intervention is not IN_PROGRESS")
        void whenNotInProgress_throws() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            Intervention iv = buildIntervention(1L, InterventionStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(iv));

            assertThatThrownBy(() -> service.updateNotes(1L, "Test", jwt))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("en cours");
        }

        @Test
        @DisplayName("throws NotFound when missing")
        void whenIvMissing_throws() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            when(interventionRepository.findById(42L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.updateNotes(42L, "x", jwt))
                    .isInstanceOf(com.clenzy.exception.NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("updateValidatedRooms")
    class UpdateValidatedRooms {

        @Test
        @DisplayName("rejects invalid JSON before opening DB transaction")
        void whenInvalidJson_throws() throws Exception {
            Jwt jwt = mock(Jwt.class);
            when(objectMapper.readTree(anyString()))
                    .thenThrow(new com.fasterxml.jackson.core.JsonProcessingException("bad") {});

            assertThatThrownBy(() -> service.updateValidatedRooms(1L, "not-json", jwt))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("JSON");
        }

        @Test
        @DisplayName("updates when JSON valid and intervention IN_PROGRESS")
        void happyPath_updates() throws Exception {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            Intervention iv = buildIntervention(1L, InterventionStatus.IN_PROGRESS);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(iv));
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToResponse(any()))
                    .thenReturn(buildResultResponse(1L, "IN_PROGRESS", "T"));
            when(objectMapper.readTree(anyString())).thenReturn(null);

            service.updateValidatedRooms(1L, "{\"room\":\"living\"}", jwt);

            ArgumentCaptor<Intervention> cap = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(cap.capture());
            assertThat(cap.getValue().getValidatedRooms()).isEqualTo("{\"room\":\"living\"}");
        }

        @Test
        @DisplayName("rejects when intervention status not IN_PROGRESS")
        void whenStatusInvalid_throws() throws Exception {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            Intervention iv = buildIntervention(1L, InterventionStatus.COMPLETED);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(iv));
            when(objectMapper.readTree(anyString())).thenReturn(null);

            assertThatThrownBy(() -> service.updateValidatedRooms(1L, "{}", jwt))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("en cours");
        }
    }

    @Nested
    @DisplayName("updateCompletedSteps")
    class UpdateCompletedSteps {

        @Test
        @DisplayName("rejects invalid JSON")
        void whenInvalidJson_throws() throws Exception {
            Jwt jwt = mock(Jwt.class);
            when(objectMapper.readTree(anyString()))
                    .thenThrow(new com.fasterxml.jackson.core.JsonProcessingException("bad") {});

            assertThatThrownBy(() -> service.updateCompletedSteps(1L, "not-json", jwt))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("JSON");
        }

        @Test
        @DisplayName("updates when JSON valid")
        void happyPath_updates() throws Exception {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            Intervention iv = buildIntervention(1L, InterventionStatus.IN_PROGRESS);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(iv));
            when(interventionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(interventionMapper.convertToResponse(any()))
                    .thenReturn(buildResultResponse(1L, "IN_PROGRESS", "T"));
            when(objectMapper.readTree(anyString())).thenReturn(null);

            service.updateCompletedSteps(1L, "[1,2]", jwt);

            ArgumentCaptor<Intervention> cap = ArgumentCaptor.forClass(Intervention.class);
            verify(interventionRepository).save(cap.capture());
            assertThat(cap.getValue().getCompletedSteps()).isEqualTo("[1,2]");
        }

        @Test
        @DisplayName("throws NotFound when intervention missing")
        void whenIvMissing_throws() throws Exception {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            when(objectMapper.readTree(anyString())).thenReturn(null);
            when(interventionRepository.findById(42L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.updateCompletedSteps(42L, "[]", jwt))
                    .isInstanceOf(com.clenzy.exception.NotFoundException.class);
        }

        @Test
        @DisplayName("rejects when status not IN_PROGRESS")
        void whenStatusInvalid_throws() throws Exception {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");
            Intervention iv = buildIntervention(1L, InterventionStatus.CANCELLED);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(iv));
            when(objectMapper.readTree(anyString())).thenReturn(null);

            assertThatThrownBy(() -> service.updateCompletedSteps(1L, "[]", jwt))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("en cours");
        }
    }
}
