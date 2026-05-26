package com.clenzy.service.agent.vision;

import com.clenzy.repository.AssistantMessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class VisionTokenUsageServiceTest {

    private static final Instant T0 = Instant.parse("2026-05-26T12:00:00Z");

    private AssistantMessageRepository repository;
    private VisionTokenUsageService service;

    @BeforeEach
    void setUp() {
        repository = mock(AssistantMessageRepository.class);
        Clock fixed = Clock.fixed(T0, ZoneId.of("UTC"));
        service = new VisionTokenUsageService(repository, fixed);
    }

    @Test
    void getMonthlyUsage_querySumOver30Days() {
        when(repository.sumVisionPromptTokensSince(eq(1L), any())).thenReturn(150_000L);

        long usage = service.getMonthlyUsage(1L);

        assertEquals(150_000L, usage);
        ArgumentCaptor<LocalDateTime> sinceCap = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(repository).sumVisionPromptTokensSince(eq(1L), sinceCap.capture());
        // Fenetre exactement 30 jours
        LocalDateTime expected = LocalDateTime.ofInstant(T0, ZoneId.of("UTC")).minusDays(30);
        assertEquals(0, ChronoUnit.SECONDS.between(expected, sinceCap.getValue()));
    }

    @Test
    void getMonthlyUsage_nullSum_returnsZero() {
        when(repository.sumVisionPromptTokensSince(any(), any())).thenReturn(null);
        assertEquals(0L, service.getMonthlyUsage(1L));
    }

    @Test
    void getMonthlyUsage_queryFailure_returnsZero_doesNotThrow() {
        when(repository.sumVisionPromptTokensSince(any(), any()))
                .thenThrow(new RuntimeException("DB down"));
        assertDoesNotThrow(() -> assertEquals(0L, service.getMonthlyUsage(1L)));
    }

    @Test
    void getMonthlyUsage_nullOrgId_returnsZero_noQuery() {
        assertEquals(0L, service.getMonthlyUsage(null));
        verifyNoInteractions(repository);
    }

    @Test
    void snapshot_includesWindowAndComputedAt() {
        when(repository.sumVisionPromptTokensSince(any(), any())).thenReturn(42L);

        VisionTokenUsageService.UsageSnapshot snap = service.snapshot(1L);

        assertEquals(1L, snap.organizationId());
        assertEquals(42L, snap.tokensLast30Days());
        assertEquals(30, snap.windowDays());
        assertEquals(LocalDateTime.ofInstant(T0, ZoneId.of("UTC")), snap.computedAt());
    }
}
