package com.clenzy.controller;

import com.clenzy.dto.PricingConfigDto;
import com.clenzy.service.PricingConfigService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * Tests unitaires du PricingConfigController.
 * L'autorisation (SUPER_ADMIN / SUPER_MANAGER) est gérée par @PreAuthorize
 * au niveau classe et testée via les tests d'intégration Spring Security.
 * Ici on vérifie uniquement la délégation vers le service.
 */
@ExtendWith(MockitoExtension.class)
class PricingConfigControllerTest {

    @Mock private PricingConfigService pricingConfigService;

    private PricingConfigController controller;

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
        controller = new PricingConfigController(pricingConfigService);
    }

    @Nested
    @DisplayName("getCurrentConfig")
    class GetConfig {
        @Test
        void whenCalled_thenDelegatesToService() {
            PricingConfigDto dto = mock(PricingConfigDto.class);
            when(pricingConfigService.getCurrentConfig()).thenReturn(dto);

            ResponseEntity<PricingConfigDto> response = controller.getCurrentConfig();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isEqualTo(dto);
            verify(pricingConfigService).getCurrentConfig();
        }
    }

    @Nested
    @DisplayName("updateConfig")
    class UpdateConfig {
        @Test
        void whenCalled_thenDelegatesToService() {
            PricingConfigDto dto = mock(PricingConfigDto.class);
            PricingConfigDto updated = mock(PricingConfigDto.class);
            when(pricingConfigService.updateConfig(dto)).thenReturn(updated);

            ResponseEntity<PricingConfigDto> response = controller.updateConfig(dto, createJwt("SUPER_ADMIN"));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isEqualTo(updated);
            verify(pricingConfigService).updateConfig(dto);
        }

        @Test
        void whenManager_thenDelegatesToService() {
            PricingConfigDto dto = mock(PricingConfigDto.class);
            PricingConfigDto updated = mock(PricingConfigDto.class);
            when(pricingConfigService.updateConfig(dto)).thenReturn(updated);

            ResponseEntity<PricingConfigDto> response = controller.updateConfig(dto, createJwt("SUPER_MANAGER"));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isEqualTo(updated);
        }
    }
}
