package com.clenzy.controller;

import com.clenzy.dto.NotificationPreferenceDto;
import com.clenzy.service.NotificationPreferenceService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationPreferenceControllerTest {

    @Mock private NotificationPreferenceService preferenceService;

    private NotificationPreferenceController controller;

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
        controller = new NotificationPreferenceController(preferenceService);
    }

    @Nested
    @DisplayName("getPreferences")
    class GetPreferences {
        @Test
        void whenGetPreferences_thenReturnsMap() {
            Map<String, Boolean> prefs = Map.of("email", true, "push", false);
            when(preferenceService.getPreferencesForUser("user-123")).thenReturn(prefs);

            Jwt jwt = createJwt();
            ResponseEntity<Map<String, Boolean>> response = controller.getPreferences(jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("email", true);
            assertThat(response.getBody()).containsEntry("push", false);
        }
    }

    @Nested
    @DisplayName("updatePreferences")
    class UpdatePreferences {
        @Test
        void whenUpdate_thenReturnsUpdated() {
            Map<String, Boolean> updated = Map.of("email", false, "push", true);
            when(preferenceService.getPreferencesForUser("user-123")).thenReturn(updated);

            NotificationPreferenceDto dto = new NotificationPreferenceDto();
            dto.preferences = Map.of("email", false, "push", true);

            Jwt jwt = createJwt();
            ResponseEntity<Map<String, Boolean>> response = controller.updatePreferences(dto, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(preferenceService).updatePreferences(eq("user-123"), eq(dto.preferences));
        }
    }
}
