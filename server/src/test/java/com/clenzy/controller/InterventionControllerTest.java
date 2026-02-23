package com.clenzy.controller;

import com.clenzy.dto.InterventionDto;
import com.clenzy.dto.InterventionValidationRequest;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.InterventionService;
import com.clenzy.tenant.TenantContext;
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
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InterventionControllerTest {

    @Mock private InterventionService interventionService;
    @Mock private InterventionRepository interventionRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private UserRepository userRepository;
    @Mock private TenantContext tenantContext;

    private InterventionController controller;

    private Jwt createJwt() {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @BeforeEach
    void setUp() {
        controller = new InterventionController(interventionService, interventionRepository,
                reservationRepository, userRepository, tenantContext);
    }

    @Nested
    @DisplayName("create")
    class Create {
        @Test
        void whenCreate_thenReturns201() {
            InterventionDto dto = new InterventionDto();
            InterventionDto created = new InterventionDto();
            created.id = 1L;

            Jwt jwt = createJwt();
            when(interventionService.create(any(InterventionDto.class), eq(jwt))).thenReturn(created);

            ResponseEntity<InterventionDto> response = controller.create(dto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(201);
            assertThat(response.getBody().id).isEqualTo(1L);
        }
    }

    @Nested
    @DisplayName("update")
    class Update {
        @Test
        void whenUpdate_thenDelegates() {
            InterventionDto dto = new InterventionDto();
            InterventionDto updated = new InterventionDto();
            updated.id = 1L;
            Jwt jwt = createJwt();

            when(interventionService.update(eq(1L), any(InterventionDto.class), eq(jwt))).thenReturn(updated);

            InterventionDto result = controller.update(1L, dto, jwt);
            assertThat(result.id).isEqualTo(1L);
        }
    }

    @Nested
    @DisplayName("get")
    class Get {
        @Test
        void whenGet_thenDelegates() {
            InterventionDto dto = new InterventionDto();
            dto.id = 1L;
            Jwt jwt = createJwt();

            when(interventionService.getById(1L, jwt)).thenReturn(dto);

            InterventionDto result = controller.get(1L, jwt);
            assertThat(result.id).isEqualTo(1L);
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
            Page<InterventionDto> page = new PageImpl<>(List.of(new InterventionDto()));

            when(interventionService.listWithRoleBasedAccess(pageable, null, null, null, null, jwt))
                    .thenReturn(page);

            Page<InterventionDto> result = controller.list(pageable, null, null, null, null, jwt);
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
        void whenUpdateStatus_thenDelegates() {
            Jwt jwt = createJwt();
            InterventionDto updated = new InterventionDto();
            updated.id = 1L;
            when(interventionService.updateStatus(1L, "IN_PROGRESS", jwt)).thenReturn(updated);

            InterventionDto result = controller.updateStatus(1L, "IN_PROGRESS", jwt);
            assertThat(result.id).isEqualTo(1L);
        }
    }

    @Nested
    @DisplayName("assign")
    class Assign {
        @Test
        void whenAssignUser_thenDelegates() {
            Jwt jwt = createJwt();
            InterventionDto updated = new InterventionDto();
            updated.id = 1L;
            when(interventionService.assign(1L, 5L, null, jwt)).thenReturn(updated);

            InterventionDto result = controller.assign(1L, 5L, null, jwt);
            assertThat(result.id).isEqualTo(1L);
        }

        @Test
        void whenAssignTeam_thenDelegates() {
            Jwt jwt = createJwt();
            InterventionDto updated = new InterventionDto();
            updated.id = 1L;
            when(interventionService.assign(1L, null, 3L, jwt)).thenReturn(updated);

            InterventionDto result = controller.assign(1L, null, 3L, jwt);
            assertThat(result.id).isEqualTo(1L);
        }
    }

    @Nested
    @DisplayName("validate")
    class Validate {
        @Test
        void whenValidate_thenDelegates() {
            Jwt jwt = createJwt();
            InterventionDto updated = new InterventionDto();
            updated.id = 1L;

            InterventionValidationRequest request = new InterventionValidationRequest();
            request.setEstimatedCost(BigDecimal.valueOf(150));

            when(interventionService.validateIntervention(eq(1L), eq(BigDecimal.valueOf(150)), eq(jwt)))
                    .thenReturn(updated);

            InterventionDto result = controller.validate(1L, request, jwt);
            assertThat(result.id).isEqualTo(1L);
        }
    }

    @Nested
    @DisplayName("startIntervention")
    class Start {
        @Test
        void whenStart_thenDelegates() {
            Jwt jwt = createJwt();
            InterventionDto updated = new InterventionDto();
            when(interventionService.startIntervention(1L, jwt)).thenReturn(updated);

            InterventionDto result = controller.startIntervention(1L, jwt);
            assertThat(result).isNotNull();
        }
    }

    @Nested
    @DisplayName("reopenIntervention")
    class Reopen {
        @Test
        void whenReopen_thenDelegates() {
            Jwt jwt = createJwt();
            InterventionDto updated = new InterventionDto();
            when(interventionService.reopenIntervention(1L, jwt)).thenReturn(updated);

            InterventionDto result = controller.reopenIntervention(1L, jwt);
            assertThat(result).isNotNull();
        }
    }

    @Nested
    @DisplayName("updateProgress")
    class Progress {
        @Test
        void whenUpdateProgress_thenDelegates() {
            Jwt jwt = createJwt();
            InterventionDto updated = new InterventionDto();
            when(interventionService.updateProgress(1L, 75, jwt)).thenReturn(updated);

            InterventionDto result = controller.updateProgress(1L, 75, jwt);
            assertThat(result).isNotNull();
        }
    }

    @Nested
    @DisplayName("updateNotes")
    class Notes {
        @Test
        void whenUpdateNotes_thenDelegates() {
            Jwt jwt = createJwt();
            InterventionDto updated = new InterventionDto();
            when(interventionService.updateNotes(1L, "notes", jwt)).thenReturn(updated);

            InterventionDto result = controller.updateNotes(1L, "notes", jwt);
            assertThat(result).isNotNull();
        }
    }

    @Nested
    @DisplayName("testAuth")
    class TestAuth {
        @Test
        void whenAuthenticated_thenReturnsSubject() {
            Jwt jwt = createJwt();
            ResponseEntity<String> response = controller.testAuth(jwt);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).contains("user-123");
        }

        @Test
        void whenNotAuthenticated_thenReturns401() {
            ResponseEntity<String> response = controller.testAuth(null);
            assertThat(response.getStatusCode().value()).isEqualTo(401);
        }
    }

    @Nested
    @DisplayName("planning")
    class Planning {
        @Test
        void whenAdminWithProperties_thenReturnsMapping() {
            Jwt jwt = createJwt();
            User user = new User();
            user.setId(1L);
            user.setRole(UserRole.SUPER_ADMIN);
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.of(user));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Intervention intervention = new Intervention();
            intervention.setId(10L);
            intervention.setType("CLEANING");
            intervention.setStatus(InterventionStatus.IN_PROGRESS);
            intervention.setPriority("HIGH");
            intervention.setTitle("Clean room");
            intervention.setScheduledDate(LocalDateTime.of(2026, 3, 1, 10, 0));
            intervention.setEstimatedDurationHours(2);

            Property property = new Property();
            property.setId(1L);
            property.setName("Apt A");
            intervention.setProperty(property);

            when(interventionRepository.findByPropertyIdsAndDateRange(eq(List.of(1L)), any(), any(), eq(1L)))
                    .thenReturn(List.of(intervention));

            ResponseEntity<List<Map<String, Object>>> response = controller.getPlanningInterventions(
                    jwt, List.of(1L), null, null, null);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
            assertThat(response.getBody().get(0).get("status")).isEqualTo("in_progress");
            assertThat(response.getBody().get(0).get("propertyName")).isEqualTo("Apt A");
        }
    }
}
