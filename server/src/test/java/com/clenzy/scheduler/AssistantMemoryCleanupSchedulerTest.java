package com.clenzy.scheduler;

import com.clenzy.repository.AssistantMemoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class AssistantMemoryCleanupSchedulerTest {

    private AssistantMemoryRepository repository;

    @BeforeEach
    void setUp() {
        repository = mock(AssistantMemoryRepository.class);
    }

    @Test
    void runOnce_disabled_skipsDelete() {
        AssistantMemoryCleanupScheduler scheduler = new AssistantMemoryCleanupScheduler(
                repository, fixedClockAt("2026-05-26T03:00:00Z"), false);

        int deleted = scheduler.runOnce();

        assertEquals(0, deleted);
        verifyNoInteractions(repository);
    }

    @Test
    void runOnce_enabled_callsDeleteWith6MonthsThreshold() {
        when(repository.deleteStaleAndExpired(any(), any())).thenReturn(7);
        AssistantMemoryCleanupScheduler scheduler = new AssistantMemoryCleanupScheduler(
                repository, fixedClockAt("2026-05-26T03:00:00Z"), true);

        int deleted = scheduler.runOnce();

        assertEquals(7, deleted);
        ArgumentCaptor<LocalDateTime> staleCap = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> nowCap = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(repository).deleteStaleAndExpired(staleCap.capture(), nowCap.capture());

        LocalDateTime now = LocalDateTime.ofInstant(
                Instant.parse("2026-05-26T03:00:00Z"), ZoneOffset.UTC);
        assertEquals(now, nowCap.getValue());
        // 6 mois avant le 26 mai = 26 novembre 2025
        assertEquals(now.minusMonths(6), staleCap.getValue());
    }

    @Test
    void runOnce_repositoryThrows_returnsZero_doesNotPropagate() {
        when(repository.deleteStaleAndExpired(any(), any()))
                .thenThrow(new RuntimeException("DB connection lost"));
        AssistantMemoryCleanupScheduler scheduler = new AssistantMemoryCleanupScheduler(
                repository, fixedClockAt("2026-05-26T03:00:00Z"), true);

        // L'echec ne doit JAMAIS propager — le scheduler doit rester resilient
        assertDoesNotThrow(() -> {
            int deleted = scheduler.runOnce();
            assertEquals(0, deleted);
        });
    }

    @Test
    void runOnce_nothingToDelete_returnsZeroWithoutError() {
        when(repository.deleteStaleAndExpired(any(), any())).thenReturn(0);
        AssistantMemoryCleanupScheduler scheduler = new AssistantMemoryCleanupScheduler(
                repository, fixedClockAt("2026-05-26T03:00:00Z"), true);

        int deleted = scheduler.runOnce();

        assertEquals(0, deleted);
        verify(repository).deleteStaleAndExpired(any(), any());
    }

    @Test
    void runWeekly_delegatesToRunOnce() {
        when(repository.deleteStaleAndExpired(any(), any())).thenReturn(3);
        AssistantMemoryCleanupScheduler scheduler = new AssistantMemoryCleanupScheduler(
                repository, fixedClockAt("2026-05-26T03:00:00Z"), true);

        scheduler.runWeekly();

        verify(repository).deleteStaleAndExpired(any(), any());
    }

    private static Clock fixedClockAt(String iso) {
        return Clock.fixed(Instant.parse(iso), ZoneId.of("UTC"));
    }
}
