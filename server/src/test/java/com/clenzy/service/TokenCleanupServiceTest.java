package com.clenzy.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TokenCleanupServiceTest {

    @Mock private JwtTokenService jwtTokenService;

    private TokenCleanupService service;

    @BeforeEach
    void setUp() {
        service = new TokenCleanupService(jwtTokenService);
    }

    // ===== SCHEDULED CLEANUP =====

    @Nested
    class ScheduledTokenCleanup {

        @Test
        void whenCalled_thenDelegatesAndLogs() {
            when(jwtTokenService.getStats())
                    .thenReturn(Map.of("cacheSize", 10L, "blacklistSize", 5L))
                    .thenReturn(Map.of("cacheSize", 8L, "blacklistSize", 3L));

            service.scheduledTokenCleanup();

            verify(jwtTokenService).cleanupExpiredTokens();
            verify(jwtTokenService, times(2)).getStats();
        }

        @Test
        void whenExceptionThrown_thenDoesNotPropagate() {
            when(jwtTokenService.getStats()).thenThrow(new RuntimeException("stats error"));

            // Should not throw — scheduled method catches exceptions
            service.scheduledTokenCleanup();
        }
    }

    // ===== MANUAL CLEANUP =====

    @Nested
    class ManualTokenCleanup {

        @Test
        void whenCalled_thenDelegates() {
            when(jwtTokenService.getStats())
                    .thenReturn(Map.of("cacheSize", 10L, "blacklistSize", 5L))
                    .thenReturn(Map.of("cacheSize", 7L, "blacklistSize", 2L));

            service.manualTokenCleanup();

            verify(jwtTokenService).cleanupExpiredTokens();
        }

        @Test
        void whenExceptionThrown_thenPropagates() {
            when(jwtTokenService.getStats()).thenThrow(new RuntimeException("error"));

            assertThatThrownBy(() -> service.manualTokenCleanup())
                    .isInstanceOf(RuntimeException.class);
        }
    }

    // ===== GET CLEANUP INFO =====

    @Nested
    class GetCleanupInfo {

        @Test
        void whenStatsAvailable_thenFormatsInfo() {
            when(jwtTokenService.getStats())
                    .thenReturn(Map.of("cacheSize", 10, "blacklistSize", 5, "lastCleanup", "2025-01-01"));

            String info = service.getCleanupInfo();

            assertThat(info).contains("10").contains("5");
        }

        @Test
        void whenStatsError_thenReturnsErrorMessage() {
            when(jwtTokenService.getStats()).thenThrow(new RuntimeException("fail"));

            String info = service.getCleanupInfo();

            assertThat(info).contains("Erreur");
        }
    }
}
