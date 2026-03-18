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
        @DisplayName("100% progress delegates to lifecycleService.completeIntervention")
        void whenProgressIs100_thenDelegatesToComplete() {
            Jwt jwt = mockJwtWithRole("SUPER_ADMIN");

            Intervention intervention = buildIntervention(1L, InterventionStatus.IN_PROGRESS);
            InterventionResponse resultResponse = buildResultResponse(1L, "COMPLETED", "Test");

            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));
            when(lifecycleService.completeIntervention(1L, jwt)).thenReturn(resultResponse);

            InterventionResponse result = service.updateProgress(1L, 100, jwt);

            assertThat(result.status()).isEqualTo("COMPLETED");
            verify(lifecycleService).completeIntervention(1L, jwt);
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
}
