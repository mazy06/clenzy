package com.clenzy.controller;

import com.clenzy.dto.CreateInterventionRequest;
import com.clenzy.dto.InterventionResponse;
import com.clenzy.dto.InterventionValidationRequest;
import com.clenzy.dto.UpdateInterventionRequest;
import com.clenzy.service.InterventionLifecycleService;
import com.clenzy.service.InterventionPlanningService;
import com.clenzy.service.InterventionProgressService;
import com.clenzy.service.InterventionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InterventionControllerTest {

    @Mock private InterventionService interventionService;
    @Mock private InterventionPlanningService planningService;
    @Mock private InterventionLifecycleService lifecycleService;
    @Mock private InterventionProgressService progressService;

    private InterventionController controller;

    private Jwt createJwt() {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    private InterventionResponse buildResponse(Long id) {
        return InterventionResponse.builder().id(id).build();
    }

    @BeforeEach
    void setUp() {
        controller = new InterventionController(interventionService, planningService, lifecycleService, progressService);
    }

    @Nested
    @DisplayName("create")
    class Create {
        @Test
        void whenCreate_thenReturns201() {
            CreateInterventionRequest request = new CreateInterventionRequest(
                    "Test title", null, "CLEANING", "HIGH", 1L, 1L, "2026-03-01T10:00:00", null, null, null);
            InterventionResponse created = buildResponse(1L);

            Jwt jwt = createJwt();
            when(interventionService.create(any(CreateInterventionRequest.class), eq(jwt))).thenReturn(created);

            ResponseEntity<InterventionResponse> response = controller.create(request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(201);
            assertThat(response.getBody().id()).isEqualTo(1L);
        }
    }

    @Nested
    @DisplayName("update")
    class Update {
        @Test
        void whenUpdate_thenDelegates() {
            UpdateInterventionRequest request = new UpdateInterventionRequest(
                    null, null, null, null, null, null, null, null, null);
            InterventionResponse updated = buildResponse(1L);
            Jwt jwt = createJwt();

            when(interventionService.update(eq(1L), any(UpdateInterventionRequest.class), eq(jwt))).thenReturn(updated);

            InterventionResponse result = controller.update(1L, request, jwt);
            assertThat(result.id()).isEqualTo(1L);
        }
    }

    @Nested
    @DisplayName("get")
    class Get {
        @Test
        void whenGet_thenDelegates() {
            InterventionResponse response = buildResponse(1L);
            Jwt jwt = createJwt();

            when(interventionService.getById(1L, jwt)).thenReturn(response);

            InterventionResponse result = controller.get(1L, jwt);
            assertThat(result.id()).isEqualTo(1L);
        }

        @Test
        void whenGetThrows_thenPropagates() {
            Jwt jwt = createJwt();
            when(interventionService.getById(1L, jwt)).thenThrow(new RuntimeException("Not found"));

            assertThatThrownBy(() -> controller.get(1L, jwt))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessage("Not found");
        }
    }

    @Nested
    @DisplayName("list")
    class ListInterventions {
        @Test
        void whenList_thenDelegates() {
            Jwt jwt = createJwt();
            var pageable = PageRequest.of(0, 10);
            Page<InterventionResponse> page = new PageImpl<>(List.of(buildResponse(1L)));

            when(interventionService.listWithRoleBasedAccess(pageable, null, null, null, null, null, null, jwt))
                    .thenReturn(page);

            Page<InterventionResponse> result = controller.list(pageable, null, null, null, null, null, null, jwt);
            assertThat(result.getContent()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("delete")
    class Delete {
        @Test
        void whenDelete_thenDelegates() {
            Jwt jwt = createJwt();
            controller.delete(1L, jwt);
            verify(interventionService).delete(1L, jwt);
        }
    }

    @Nested
    @DisplayName("updateStatus")
    class UpdateStatus {
        @Test
        void whenUpdateStatus_thenDelegatesToLifecycleService() {
            Jwt jwt = createJwt();
            InterventionResponse updated = buildResponse(1L);
            when(lifecycleService.updateStatus(1L, "IN_PROGRESS", jwt)).thenReturn(updated);

            InterventionResponse result = controller.updateStatus(1L, "IN_PROGRESS", jwt);
            assertThat(result.id()).isEqualTo(1L);
        }
    }

    @Nested
    @DisplayName("assign")
    class Assign {
        @Test
        void whenAssignUser_thenDelegates() {
            Jwt jwt = createJwt();
            InterventionResponse updated = buildResponse(1L);
            when(interventionService.assign(1L, 5L, null, jwt)).thenReturn(updated);

            InterventionResponse result = controller.assign(1L, 5L, null, jwt);
            assertThat(result.id()).isEqualTo(1L);
        }

        @Test
        void whenAssignTeam_thenDelegates() {
            Jwt jwt = createJwt();
            InterventionResponse updated = buildResponse(1L);
            when(interventionService.assign(1L, null, 3L, jwt)).thenReturn(updated);

            InterventionResponse result = controller.assign(1L, null, 3L, jwt);
            assertThat(result.id()).isEqualTo(1L);
        }
    }

    @Nested
    @DisplayName("validate")
    class Validate {
        @Test
        void whenValidate_thenDelegatesToLifecycleService() {
            Jwt jwt = createJwt();
            InterventionResponse updated = buildResponse(1L);

            InterventionValidationRequest request = new InterventionValidationRequest();
            request.setEstimatedCost(BigDecimal.valueOf(150));

            when(lifecycleService.validateIntervention(eq(1L), eq(BigDecimal.valueOf(150)), eq(jwt)))
                    .thenReturn(updated);

            InterventionResponse result = controller.validate(1L, request, jwt);
            assertThat(result.id()).isEqualTo(1L);
        }
    }

    @Nested
    @DisplayName("startIntervention")
    class Start {
        @Test
        void whenStart_thenDelegatesToLifecycleService() {
            Jwt jwt = createJwt();
            InterventionResponse updated = buildResponse(1L);
            when(lifecycleService.startIntervention(1L, jwt)).thenReturn(updated);

            InterventionResponse result = controller.startIntervention(1L, jwt);
            assertThat(result).isNotNull();
        }
    }

    @Nested
    @DisplayName("reopenIntervention")
    class Reopen {
        @Test
        void whenReopen_thenDelegatesToLifecycleService() {
            Jwt jwt = createJwt();
            InterventionResponse updated = buildResponse(1L);
            when(lifecycleService.reopenIntervention(1L, jwt)).thenReturn(updated);

            InterventionResponse result = controller.reopenIntervention(1L, jwt);
            assertThat(result).isNotNull();
        }
    }

    @Nested
    @DisplayName("updateProgress")
    class Progress {
        @Test
        void whenUpdateProgress_thenDelegatesToProgressService() {
            Jwt jwt = createJwt();
            InterventionResponse updated = buildResponse(1L);
            when(progressService.updateProgress(1L, 75, jwt)).thenReturn(updated);

            InterventionResponse result = controller.updateProgress(1L, 75, jwt);
            assertThat(result).isNotNull();
        }
    }

    @Nested
    @DisplayName("updateNotes")
    class Notes {
        @Test
        void whenUpdateNotes_thenDelegatesToProgressService() {
            Jwt jwt = createJwt();
            InterventionResponse updated = buildResponse(1L);
            when(progressService.updateNotes(1L, "notes", jwt)).thenReturn(updated);

            InterventionResponse result = controller.updateNotes(1L, "notes", jwt);
            assertThat(result).isNotNull();
        }
    }

    @Nested
    @DisplayName("planning")
    class Planning {
        @Test
        void whenPlanningCalled_thenDelegatesToService() {
            Jwt jwt = createJwt();
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("id", 10L);
            entry.put("status", "in_progress");
            entry.put("propertyName", "Apt A");

            when(planningService.getPlanningInterventions(eq(jwt), eq(List.of(1L)), isNull(), isNull(), isNull()))
                    .thenReturn(List.of(entry));

            ResponseEntity<List<Map<String, Object>>> response = controller.getPlanningInterventions(
                    jwt, List.of(1L), null, null, null);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
            assertThat(response.getBody().get(0).get("status")).isEqualTo("in_progress");
            assertThat(response.getBody().get(0).get("propertyName")).isEqualTo("Apt A");
        }
    }
}
