package com.clenzy.integration.channex.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.env.MockEnvironment;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Agregation ARI par propriete (exigence certification Channex) : fusion des
 * plages, un push par propriete au flush, backoff sur echec sans blocage.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ChannexAriBatcher")
class ChannexAriBatcherTest {

    private static final ChannexSyncService.ChannexSyncResult OK =
        new ChannexSyncService.ChannexSyncResult(true, "ok", 0, 0);
    private static final ChannexSyncService.ChannexSyncResult KO =
        new ChannexSyncService.ChannexSyncResult(false, "429", 0, 0);

    @Mock private ChannexSyncService syncService;

    private ChannexAriBatcher batcher;

    @BeforeEach
    void setUp() {
        batcher = new ChannexAriBatcher(syncService,
            Clock.fixed(Instant.parse("2026-07-09T10:00:00Z"), ZoneOffset.UTC),
            new MockEnvironment());
    }

    @Test
    @DisplayName("enqueue x3 meme propriete -> UN SEUL push couvrant l'enveloppe des plages")
    void mergesRangesPerProperty() {
        when(syncService.processCalendarRange(anyLong(), anyLong(), any(), any())).thenReturn(OK);

        batcher.enqueue(100L, 42L, LocalDate.parse("2026-06-05"), LocalDate.parse("2026-06-07"));
        batcher.enqueue(100L, 42L, LocalDate.parse("2026-06-01"), LocalDate.parse("2026-06-02"));
        batcher.enqueue(100L, 42L, LocalDate.parse("2026-06-10"), LocalDate.parse("2026-06-12"));
        batcher.flush();

        verify(syncService, times(1)).processCalendarRange(
            eq(100L), eq(42L),
            eq(LocalDate.parse("2026-06-01")), eq(LocalDate.parse("2026-06-12")));
        assertThat(batcher.pendingCount()).isZero();
    }

    @Test
    @DisplayName("proprietes distinctes -> un push chacune")
    void separatePushPerProperty() {
        when(syncService.processCalendarRange(anyLong(), anyLong(), any(), any())).thenReturn(OK);

        batcher.enqueue(100L, 42L, LocalDate.parse("2026-06-01"), LocalDate.parse("2026-06-03"));
        batcher.enqueue(200L, 42L, LocalDate.parse("2026-06-01"), LocalDate.parse("2026-06-03"));
        batcher.flush();

        verify(syncService).processCalendarRange(eq(100L), eq(42L), any(), any());
        verify(syncService).processCalendarRange(eq(200L), eq(42L), any(), any());
    }

    @Test
    @DisplayName("push KO -> re-enfile avec differe (backoff), pas de re-push immediat")
    void requeuesWithBackoffOnFailure() {
        when(syncService.processCalendarRange(anyLong(), anyLong(), any(), any())).thenReturn(KO);

        batcher.enqueue(100L, 42L, LocalDate.parse("2026-06-01"), LocalDate.parse("2026-06-03"));
        batcher.flush();

        // Re-enfile mais differee de retrySeconds (60s > horloge fixe) : un
        // flush immediat ne doit PAS re-pousser.
        assertThat(batcher.pendingCount()).isEqualTo(1);
        batcher.flush();
        verify(syncService, times(1)).processCalendarRange(anyLong(), anyLong(), any(), any());
    }

    @Test
    @DisplayName("exception inattendue du sync -> traitee comme un echec (retry), pas de crash")
    void unexpectedExceptionRequeues() {
        when(syncService.processCalendarRange(anyLong(), anyLong(), any(), any()))
            .thenThrow(new RuntimeException("DB down"));

        batcher.enqueue(100L, 42L, LocalDate.parse("2026-06-01"), LocalDate.parse("2026-06-03"));
        batcher.flush();

        assertThat(batcher.pendingCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("flush a vide -> aucun appel")
    void emptyFlushNoop() {
        batcher.flush();
        verify(syncService, never()).processCalendarRange(anyLong(), anyLong(), any(), any());
    }
}
