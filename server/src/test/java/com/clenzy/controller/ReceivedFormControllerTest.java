package com.clenzy.controller;

import com.clenzy.dto.ReceivedFormDto;
import com.clenzy.service.ReceivedFormService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReceivedFormControllerTest {

    @Mock private ReceivedFormService receivedFormService;

    private ReceivedFormController controller;

    private Jwt createJwt(String... roles) {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .claim("realm_access", Map.of("roles", List.of(roles)))
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    private ReceivedFormDto formDto() {
        return new ReceivedFormDto(1L, null, "DEVIS", "Jean Dupont", "jean@test.com",
                null, null, null, "Demande de devis", "{}", "NEW", "127.0.0.1",
                null, null, null);
    }

    @BeforeEach
    void setUp() {
        controller = new ReceivedFormController(receivedFormService);
    }

    @Nested
    @DisplayName("listForms")
    class ListForms {
        @Test
        void whenAdmin_thenReturnsOk() {
            Page<ReceivedFormDto> page = new PageImpl<>(List.of(formDto()));
            when(receivedFormService.listForms(0, 20, null, null)).thenReturn(page);

            ResponseEntity<?> response = controller.listForms(createJwt("SUPER_ADMIN"), 0, 20, null, null);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenAdminWithType_thenFiltersResult() {
            Page<ReceivedFormDto> page = new PageImpl<>(List.of());
            when(receivedFormService.listForms(0, 20, "devis", null)).thenReturn(page);

            ResponseEntity<?> response = controller.listForms(createJwt("SUPER_ADMIN"), 0, 20, "devis", null);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(receivedFormService).listForms(0, 20, "devis", null);
        }

        @Test
        void whenNullJwt_thenUnauthorized() {
            ResponseEntity<?> response = controller.listForms(null, 0, 20, null, null);
            assertThat(response.getStatusCode().value()).isEqualTo(401);
        }

        @Test
        void whenHost_thenForbidden() {
            ResponseEntity<?> response = controller.listForms(createJwt("HOST"), 0, 20, null, null);
            assertThat(response.getStatusCode().value()).isEqualTo(403);
        }
    }

    @Nested
    @DisplayName("getForm")
    class GetForm {
        @Test
        void whenFound_thenReturnsOk() {
            when(receivedFormService.getForm(1L)).thenReturn(Optional.of(formDto()));

            ResponseEntity<?> response = controller.getForm(createJwt("SUPER_ADMIN"), 1L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenNotFound_thenReturns404() {
            when(receivedFormService.getForm(1L)).thenReturn(Optional.empty());

            ResponseEntity<?> response = controller.getForm(createJwt("SUPER_ADMIN"), 1L);

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }
    }

    @Nested
    @DisplayName("updateStatus")
    class UpdateStatus {
        @Test
        void whenValidStatus_thenReturnsOk() {
            when(receivedFormService.updateStatus(1L, "READ")).thenReturn(Optional.of(formDto()));

            ResponseEntity<?> response = controller.updateStatus(createJwt("SUPER_MANAGER"), 1L, "READ");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenInvalidStatus_thenBadRequest() {
            ResponseEntity<?> response = controller.updateStatus(createJwt("SUPER_ADMIN"), 1L, "INVALID");

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenFormNotFound_thenReturns404() {
            when(receivedFormService.updateStatus(1L, "READ")).thenReturn(Optional.empty());

            ResponseEntity<?> response = controller.updateStatus(createJwt("SUPER_ADMIN"), 1L, "READ");

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }
    }

    @Nested
    @DisplayName("getStats")
    class GetStats {
        @Test
        void whenAdmin_thenReturnsStats() {
            when(receivedFormService.getStats()).thenReturn(
                    new ReceivedFormService.ReceivedFormStats(3L, 2L, 5L, 1L, 4L, 3L, 2L));

            ResponseEntity<?> response = controller.getStats(createJwt("SUPER_ADMIN"));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("totalNew", 3L);
        }

        @Test
        void whenNullJwt_thenUnauthorized() {
            ResponseEntity<?> response = controller.getStats(null);
            assertThat(response.getStatusCode().value()).isEqualTo(401);
        }
    }
}
