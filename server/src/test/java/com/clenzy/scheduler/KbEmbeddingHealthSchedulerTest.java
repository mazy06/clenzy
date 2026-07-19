package com.clenzy.scheduler;

import com.clenzy.model.KbChunk;
import com.clenzy.model.NotificationKey;
import com.clenzy.repository.KbChunkRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.agent.kb.EmbeddingService;
import com.clenzy.service.agent.kb.IngestionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class KbEmbeddingHealthSchedulerTest {

    @Mock private EmbeddingService embeddingService;
    @Mock private KbChunkRepository chunkRepository;
    @Mock private NotificationService notificationService;
    @Mock private IngestionService ingestionService;

    private KbEmbeddingHealthScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new KbEmbeddingHealthScheduler(
                embeddingService, chunkRepository, notificationService, ingestionService, true);
    }

    @Test
    void runMaintenance_reingestsOutdatedChunkerDocs_whenConfigured() {
        when(chunkRepository.countByEmbeddingIsNull()).thenReturn(0L);
        when(embeddingService.isConfigured()).thenReturn(true);

        scheduler.runMaintenance();

        verify(ingestionService).reingestOutdatedDocuments(anyInt());
    }

    @Test
    void reingestOutdated_skippedWhenNoModel() {
        when(embeddingService.isConfigured()).thenReturn(false);

        scheduler.reingestOutdated();

        verify(ingestionService, never()).reingestOutdatedDocuments(anyInt());
    }

    @Test
    void checkConfiguration_noModelAndChunksPresent_notifiesPlatformStaff() {
        when(embeddingService.isConfigured()).thenReturn(false);
        when(chunkRepository.count()).thenReturn(42L);

        scheduler.checkConfiguration();

        verify(notificationService).notifyAllPlatformStaff(
                eq(NotificationKey.AI_MODEL_EOL), anyString(), anyString(), anyString());
    }

    @Test
    void checkConfiguration_modelConfigured_noNotification() {
        when(embeddingService.isConfigured()).thenReturn(true);

        scheduler.checkConfiguration();

        verify(notificationService, never()).notifyAllPlatformStaff(any(), any(), any(), any());
        verify(chunkRepository, never()).count();
    }

    @Test
    void checkConfiguration_emptyKb_noNotification() {
        when(embeddingService.isConfigured()).thenReturn(false);
        when(chunkRepository.count()).thenReturn(0L);

        scheduler.checkConfiguration();

        verify(notificationService, never()).notifyAllPlatformStaff(any(), any(), any(), any());
    }

    @Test
    void checkConfiguration_disabled_doesNothing() {
        KbEmbeddingHealthScheduler disabled = new KbEmbeddingHealthScheduler(
                embeddingService, chunkRepository, notificationService, ingestionService, false);

        disabled.checkConfiguration();
        disabled.runMaintenance();

        verifyNoInteractions(embeddingService, chunkRepository, notificationService, ingestionService);
    }

    @Test
    void reembedOrphans_reembedsAndPersists() {
        KbChunk orphan1 = new KbChunk(1L, 0, "contenu A", null, 10);
        KbChunk orphan2 = new KbChunk(1L, 1, "contenu B", null, 10);
        when(chunkRepository.countByEmbeddingIsNull()).thenReturn(2L);
        when(embeddingService.isConfigured()).thenReturn(true);
        when(chunkRepository.findByEmbeddingIsNull(any(Pageable.class)))
                .thenReturn(List.of(orphan1, orphan2))
                .thenReturn(List.of());
        when(embeddingService.embedBatchAsVectorStrings(List.of("contenu A", "contenu B")))
                .thenReturn(List.of("[0.1]", "[0.2]"));

        scheduler.reembedOrphans();

        assertEquals("[0.1]", orphan1.getEmbedding());
        assertEquals("[0.2]", orphan2.getEmbedding());
        verify(chunkRepository).saveAll(List.of(orphan1, orphan2));
    }

    @Test
    void reembedOrphans_noModelConfigured_defers() {
        when(chunkRepository.countByEmbeddingIsNull()).thenReturn(5L);
        when(embeddingService.isConfigured()).thenReturn(false);

        scheduler.reembedOrphans();

        verify(chunkRepository, never()).findByEmbeddingIsNull(any());
        verify(embeddingService, never()).embedBatchAsVectorStrings(anyList());
    }

    @Test
    void reembedOrphans_noOrphans_noWork() {
        when(chunkRepository.countByEmbeddingIsNull()).thenReturn(0L);

        scheduler.reembedOrphans();

        verify(embeddingService, never()).isConfigured();
        verify(chunkRepository, never()).findByEmbeddingIsNull(any());
    }

    @Test
    void reembedOrphans_embeddingFailure_stopsWithoutThrowing() {
        KbChunk orphan = new KbChunk(1L, 0, "contenu", null, 10);
        when(chunkRepository.countByEmbeddingIsNull()).thenReturn(1L);
        when(embeddingService.isConfigured()).thenReturn(true);
        when(chunkRepository.findByEmbeddingIsNull(any(Pageable.class)))
                .thenReturn(List.of(orphan));
        when(embeddingService.embedBatchAsVectorStrings(anyList()))
                .thenThrow(new RuntimeException("API down"));

        scheduler.reembedOrphans();

        verify(chunkRepository, never()).saveAll(anyList());
    }
}
