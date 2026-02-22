package com.clenzy.controller;

import com.clenzy.service.JwtTokenService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TokenAdminControllerTest {

    @Mock private JwtTokenService jwtTokenService;

    private TokenAdminController controller;

    @BeforeEach
    void setUp() {
        controller = new TokenAdminController(jwtTokenService);
    }

    @Nested
    @DisplayName("getTokenStats")
    class Stats {
        @Test
        void whenSuccess_thenReturnsOk() {
            Map<String, Object> stats = Map.of("totalTokens", 100);
            when(jwtTokenService.getStats()).thenReturn(stats);

            ResponseEntity<Map<String, Object>> response = controller.getTokenStats();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("totalTokens", 100);
        }

        @Test
        void whenException_thenReturns500() {
            when(jwtTokenService.getStats()).thenThrow(new RuntimeException("err"));

            ResponseEntity<Map<String, Object>> response = controller.getTokenStats();

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("getTokenMetrics")
    class Metrics {
        @Test
        void whenSuccess_thenReturnsOk() {
            JwtTokenService.TokenMetrics metrics = mock(JwtTokenService.TokenMetrics.class);
            when(metrics.getValidTokens()).thenReturn(50L);
            when(metrics.getInvalidTokens()).thenReturn(5L);
            when(metrics.getRevokedTokens()).thenReturn(2L);
            when(metrics.getRejectedTokens()).thenReturn(1L);
            when(metrics.getCacheHits()).thenReturn(100L);
            when(metrics.getErrors()).thenReturn(0L);
            when(metrics.getTotalTokens()).thenReturn(58L);
            when(metrics.getSuccessRate()).thenReturn(96.55);
            when(jwtTokenService.getMetrics()).thenReturn(metrics);

            ResponseEntity<Map<String, Object>> response = controller.getTokenMetrics();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("validTokens", 50L);
        }

        @Test
        void whenException_thenReturns500() {
            when(jwtTokenService.getMetrics()).thenThrow(new RuntimeException("err"));

            ResponseEntity<Map<String, Object>> response = controller.getTokenMetrics();

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("cleanupExpiredTokens")
    class Cleanup {
        @Test
        void whenSuccess_thenReturnsOk() {
            Map<String, Object> stats = Map.of("remaining", 50);
            when(jwtTokenService.getStats()).thenReturn(stats);

            ResponseEntity<Map<String, Object>> response = controller.cleanupExpiredTokens();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(jwtTokenService).cleanupExpiredTokens();
        }

        @Test
        void whenException_thenReturns500() {
            doThrow(new RuntimeException("err")).when(jwtTokenService).cleanupExpiredTokens();

            ResponseEntity<Map<String, Object>> response = controller.cleanupExpiredTokens();

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("revokeToken")
    class Revoke {
        @Test
        void whenSuccess_thenReturnsOk() {
            ResponseEntity<Map<String, Object>> response = controller.revokeToken(Map.of("token", "abc123def456"));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(jwtTokenService).revokeToken("abc123def456");
        }

        @Test
        void whenNoToken_thenBadRequest() {
            ResponseEntity<Map<String, Object>> response = controller.revokeToken(Map.of());

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }

    @Nested
    @DisplayName("validateToken")
    class Validate {
        @Test
        void whenValid_thenReturnsTrue() {
            when(jwtTokenService.isTokenValid("abc123def456")).thenReturn(true);

            ResponseEntity<Map<String, Object>> response = controller.validateToken(Map.of("token", "abc123def456"));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("valid", true);
        }

        @Test
        void whenNoToken_thenBadRequest() {
            ResponseEntity<Map<String, Object>> response = controller.validateToken(Map.of());

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }

    @Nested
    @DisplayName("getBlacklistedTokens")
    class Blacklist {
        @Test
        void whenSuccess_thenReturnsOk() {
            Map<String, Object> blacklist = Map.of("count", 5);
            when(jwtTokenService.getBlacklistedTokens()).thenReturn(blacklist);

            ResponseEntity<Map<String, Object>> response = controller.getBlacklistedTokens();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("removeFromBlacklist")
    class RemoveFromBlacklist {
        @Test
        void whenExists_thenReturnsOk() {
            when(jwtTokenService.removeFromBlacklist("token-id")).thenReturn(true);

            ResponseEntity<Map<String, Object>> response = controller.removeFromBlacklist("token-id");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenNotExists_thenReturns404() {
            when(jwtTokenService.removeFromBlacklist("token-id")).thenReturn(false);

            ResponseEntity<Map<String, Object>> response = controller.removeFromBlacklist("token-id");

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }
    }

    @Nested
    @DisplayName("clearCache")
    class ClearCache {
        @Test
        void whenSuccess_thenReturnsOk() {
            ResponseEntity<Map<String, Object>> response = controller.clearCache();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(jwtTokenService).clearCache();
        }
    }

    @Nested
    @DisplayName("getHealthStatus")
    class Health {
        @Test
        void whenSuccess_thenReturnsOk() {
            Map<String, Object> health = Map.of("status", "UP");
            when(jwtTokenService.getHealthStatus()).thenReturn(health);

            ResponseEntity<Map<String, Object>> response = controller.getHealthStatus();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("status", "UP");
        }
    }
}
