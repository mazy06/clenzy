package com.clenzy.controller;

import com.clenzy.model.ReceivedForm;
import com.clenzy.repository.ReceivedFormRepository;
import org.junit.jupiter.api.*;
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
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReceivedFormControllerTest {

    @Mock private ReceivedFormRepository receivedFormRepository;

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

    @BeforeEach
    void setUp() {
        controller = new ReceivedFormController(receivedFormRepository);
    }

    @Nested
    @DisplayName("listForms")
    class ListForms {
        @Test
        void whenAdmin_thenReturnsOk() {
            ReceivedForm form = new ReceivedForm();
            Page<ReceivedForm> page = new PageImpl<>(List.of(form));
            when(receivedFormRepository.findAllByOrderByCreatedAtDesc(any(PageRequest.class))).thenReturn(page);

            ResponseEntity<?> response = controller.listForms(createJwt("SUPER_ADMIN"), 0, 20, null);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenAdminWithType_thenFiltersResult() {
            Page<ReceivedForm> page = new PageImpl<>(List.of());
            when(receivedFormRepository.findByFormTypeOrderByCreatedAtDesc(eq("DEVIS"), any(PageRequest.class))).thenReturn(page);

            ResponseEntity<?> response = controller.listForms(createJwt("SUPER_ADMIN"), 0, 20, "devis");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(receivedFormRepository).findByFormTypeOrderByCreatedAtDesc(eq("DEVIS"), any(PageRequest.class));
        }

        @Test
        void whenNullJwt_thenUnauthorized() {
            ResponseEntity<?> response = controller.listForms(null, 0, 20, null);
            assertThat(response.getStatusCode().value()).isEqualTo(401);
        }

        @Test
        void whenHost_thenForbidden() {
            ResponseEntity<?> response = controller.listForms(createJwt("HOST"), 0, 20, null);
            assertThat(response.getStatusCode().value()).isEqualTo(403);
        }
    }

    @Nested
    @DisplayName("getForm")
    class GetForm {
        @Test
        void whenFound_thenReturnsOk() {
            ReceivedForm form = new ReceivedForm();
            when(receivedFormRepository.findById(1L)).thenReturn(Optional.of(form));

            ResponseEntity<?> response = controller.getForm(createJwt("SUPER_ADMIN"), 1L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenNotFound_thenReturns404() {
            when(receivedFormRepository.findById(1L)).thenReturn(Optional.empty());

            ResponseEntity<?> response = controller.getForm(createJwt("SUPER_ADMIN"), 1L);

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }
    }

    @Nested
    @DisplayName("updateStatus")
    class UpdateStatus {
        @Test
        void whenValidStatus_thenReturnsOk() {
            ReceivedForm form = new ReceivedForm();
            when(receivedFormRepository.findById(1L)).thenReturn(Optional.of(form));
            when(receivedFormRepository.save(form)).thenReturn(form);

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
            when(receivedFormRepository.findById(1L)).thenReturn(Optional.empty());

            ResponseEntity<?> response = controller.updateStatus(createJwt("SUPER_ADMIN"), 1L, "READ");

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }
    }

    @Nested
    @DisplayName("getStats")
    class GetStats {
        @Test
        void whenAdmin_thenReturnsStats() {
            when(receivedFormRepository.countByStatus("NEW")).thenReturn(3L);
            when(receivedFormRepository.countByStatus("READ")).thenReturn(2L);
            when(receivedFormRepository.countByStatus("PROCESSED")).thenReturn(5L);
            when(receivedFormRepository.countByStatus("ARCHIVED")).thenReturn(1L);
            when(receivedFormRepository.countByFormType("DEVIS")).thenReturn(4L);
            when(receivedFormRepository.countByFormType("MAINTENANCE")).thenReturn(3L);
            when(receivedFormRepository.countByFormType("SUPPORT")).thenReturn(2L);

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
