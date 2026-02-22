package com.clenzy.controller;

import com.clenzy.dto.GdprConsentUpdateDto;
import com.clenzy.dto.GdprExportDto;
import com.clenzy.model.User;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.GdprService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GdprControllerTest {

    @Mock private GdprService gdprService;
    @Mock private UserRepository userRepository;
    @Mock private Authentication authentication;
    @Mock private HttpServletRequest httpRequest;

    private GdprController controller;

    private Jwt createJwt() {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    private void setupAuth() {
        Jwt jwt = createJwt();
        when(authentication.getPrincipal()).thenReturn(jwt);
        User user = new User();
        user.setId(1L);
        when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.of(user));
    }

    @BeforeEach
    void setUp() {
        controller = new GdprController(gdprService, userRepository);
    }

    @Nested
    @DisplayName("exportMyData")
    class Export {
        @Test
        void whenAuthenticated_thenReturnsExport() {
            setupAuth();
            GdprExportDto export = mock(GdprExportDto.class);
            when(gdprService.exportUserData(1L)).thenReturn(export);

            ResponseEntity<GdprExportDto> response = controller.exportMyData(authentication);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isEqualTo(export);
        }
    }

    @Nested
    @DisplayName("anonymizeMyData")
    class Anonymize {
        @Test
        void whenAuthenticated_thenAnonymizesAndReturnsSuccess() {
            setupAuth();

            ResponseEntity<Map<String, String>> response = controller.anonymizeMyData(authentication);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().get("status")).isEqualTo("success");
            verify(gdprService).anonymizeUser(1L);
        }
    }

    @Nested
    @DisplayName("getConsentStatus")
    class GetConsent {
        @Test
        void whenAuthenticated_thenReturnsConsentStatus() {
            setupAuth();
            Map<String, Object> status = Map.of("marketing", true, "analytics", false);
            when(gdprService.getConsentStatus(1L)).thenReturn(status);

            ResponseEntity<Map<String, Object>> response = controller.getConsentStatus(authentication);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("marketing", true);
        }
    }

    @Nested
    @DisplayName("updateConsents")
    class UpdateConsent {
        @Test
        void whenAuthenticated_thenUpdatesConsents() {
            setupAuth();
            when(httpRequest.getRemoteAddr()).thenReturn("127.0.0.1");
            GdprConsentUpdateDto dto = mock(GdprConsentUpdateDto.class);

            ResponseEntity<Map<String, String>> response = controller.updateConsents(dto, authentication, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().get("status")).isEqualTo("success");
            verify(gdprService).updateConsents(eq(1L), eq(dto), eq("127.0.0.1"));
        }
    }

    @Nested
    @DisplayName("getDataCategories")
    class DataCategories {
        @Test
        void whenCalled_thenReturnsList() {
            List<Map<String, String>> categories = List.of(
                    Map.of("category", "identity", "description", "Personal identity data")
            );
            when(gdprService.getDataCategories()).thenReturn(categories);

            ResponseEntity<List<Map<String, String>>> response = controller.getDataCategories();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("getCurrentUserId - error cases")
    class Auth {
        @Test
        void whenNullAuthentication_thenThrows() {
            assertThatThrownBy(() -> controller.exportMyData(null))
                    .isInstanceOf(RuntimeException.class);
        }

        @Test
        void whenUserNotFound_thenThrows() {
            Jwt jwt = createJwt();
            when(authentication.getPrincipal()).thenReturn(jwt);
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.exportMyData(authentication))
                    .isInstanceOf(RuntimeException.class);
        }
    }
}
