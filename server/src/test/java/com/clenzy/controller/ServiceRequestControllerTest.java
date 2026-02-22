package com.clenzy.controller;

import com.clenzy.dto.InterventionDto;
import com.clenzy.dto.ServiceRequestDto;
import com.clenzy.dto.ServiceRequestValidationRequest;
import com.clenzy.service.ServiceRequestService;
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

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ServiceRequestControllerTest {

    @Mock private ServiceRequestService service;

    private ServiceRequestController controller;

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
        controller = new ServiceRequestController(service);
    }

    @Nested
    @DisplayName("create")
    class Create {
        @Test
        void whenCreate_thenReturns201() {
            ServiceRequestDto dto = new ServiceRequestDto();
            ServiceRequestDto created = new ServiceRequestDto();
            created.id = 1L;
            when(service.create(any(ServiceRequestDto.class))).thenReturn(created);

            ResponseEntity<ServiceRequestDto> response = controller.create(dto);
            assertThat(response.getStatusCode().value()).isEqualTo(201);
            assertThat(response.getBody().id).isEqualTo(1L);
        }
    }

    @Nested
    @DisplayName("update")
    class Update {
        @Test
        void whenUpdate_thenDelegates() {
            ServiceRequestDto dto = new ServiceRequestDto();
            ServiceRequestDto updated = new ServiceRequestDto();
            updated.id = 1L;
            when(service.update(1L, dto)).thenReturn(updated);

            ServiceRequestDto result = controller.update(1L, dto);
            assertThat(result.id).isEqualTo(1L);
        }
    }

    @Nested
    @DisplayName("get")
    class Get {
        @Test
        void whenGet_thenDelegates() {
            ServiceRequestDto dto = new ServiceRequestDto();
            dto.id = 1L;
            when(service.getById(1L)).thenReturn(dto);

            ServiceRequestDto result = controller.get(1L);
            assertThat(result.id).isEqualTo(1L);
        }
    }

    @Nested
    @DisplayName("list")
    class ListRequests {
        @Test
        void whenList_thenDelegates() {
            Jwt jwt = createJwt();
            var pageable = PageRequest.of(0, 10);
            Page<ServiceRequestDto> page = new PageImpl<>(List.of(new ServiceRequestDto()));
            when(service.searchWithRoleBasedAccess(eq(pageable), isNull(), isNull(), isNull(), isNull(), eq(jwt)))
                    .thenReturn(page);

            Page<ServiceRequestDto> result = controller.list(pageable, null, null, null, null, jwt);
            assertThat(result.getContent()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("delete")
    class Delete {
        @Test
        void whenDelete_thenDelegates() {
            controller.delete(1L);
            verify(service).delete(1L);
        }
    }

    @Nested
    @DisplayName("validateAndCreateIntervention")
    class ValidateRequest {
        @Test
        void whenValidateWithRequest_thenReturns201() {
            Jwt jwt = createJwt();
            ServiceRequestValidationRequest request = new ServiceRequestValidationRequest();
            request.setTeamId(3L);
            request.setUserId(5L);
            request.setAutoAssign(true);

            InterventionDto intervention = new InterventionDto();
            intervention.id = 10L;
            when(service.validateAndCreateIntervention(1L, 3L, 5L, true, jwt)).thenReturn(intervention);

            ResponseEntity<InterventionDto> response = controller.validateAndCreateIntervention(1L, request, jwt);
            assertThat(response.getStatusCode().value()).isEqualTo(201);
            assertThat(response.getBody().id).isEqualTo(10L);
        }

        @Test
        void whenValidateWithNullRequest_thenUsesNulls() {
            Jwt jwt = createJwt();
            InterventionDto intervention = new InterventionDto();
            intervention.id = 10L;
            when(service.validateAndCreateIntervention(1L, null, null, false, jwt)).thenReturn(intervention);

            ResponseEntity<InterventionDto> response = controller.validateAndCreateIntervention(1L, null, jwt);
            assertThat(response.getStatusCode().value()).isEqualTo(201);
        }
    }

    @Nested
    @DisplayName("acceptDevis")
    class AcceptDevis {
        @Test
        void whenAcceptDevis_thenDelegates() {
            Jwt jwt = createJwt();
            ServiceRequestDto result = new ServiceRequestDto();
            result.id = 1L;
            when(service.acceptDevis(1L, jwt)).thenReturn(result);

            ResponseEntity<ServiceRequestDto> response = controller.acceptDevis(1L, jwt);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }
}
