package com.clenzy.service.agent.kb;

import com.clenzy.repository.KbChunkRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class KbSearchServiceTest {

    private EmbeddingService embeddingService;
    private KbChunkRepository chunkRepository;
    private RerankService rerankService;
    private KbSearchService service;

    @BeforeEach
    void setUp() {
        embeddingService = mock(EmbeddingService.class);
        chunkRepository = mock(KbChunkRepository.class);
        rerankService = mock(RerankService.class);
        // Defaut : rerank desactive → preserve le comportement initial des tests
        when(rerankService.isActive()).thenReturn(false);
        when(rerankService.getOverFetchFactor()).thenReturn(1);
        service = new KbSearchService(embeddingService, chunkRepository, rerankService);
    }

    @Test
    void blankQuery_returnsEmpty() {
        assertTrue(service.search(null, 1L, 5).isEmpty());
        assertTrue(service.search("", 1L, 5).isEmpty());
        assertTrue(service.search("   ", 1L, 5).isEmpty());
        verifyNoInteractions(embeddingService);
        verifyNoInteractions(chunkRepository);
    }

    @Test
    void search_transformsRowsIntoHits_withRelevance() {
        when(embeddingService.embedAsVectorString("test"))
                .thenReturn("[0.1,0.2,0.3]");
        // distance cosine 0.2 → relevance = 1 - 0.2/2 = 0.9
        List<Object[]> rows = new java.util.ArrayList<>();
        rows.add(new Object[]{42L, "Snippet 1", "doc.md", "Titre", 7L, 0.2d});
        rows.add(new Object[]{43L, "Snippet 2", "guide.md", "Guide", 8L, 0.8d});
        when(chunkRepository.searchByCosineSimilarity(anyString(), eq(1L), eq(3))).thenReturn(rows);

        List<KbSearchService.KbSearchHit> hits = service.search("test", 1L, 3);

        assertEquals(2, hits.size());
        assertEquals("Titre", hits.get(0).title());
        assertEquals("Snippet 1", hits.get(0).snippet());
        assertEquals(0.9, hits.get(0).relevance(), 0.001);
        assertEquals(7L, hits.get(0).documentId());

        // Distance 0.8 → relevance = 1 - 0.4 = 0.6
        assertEquals(0.6, hits.get(1).relevance(), 0.001);
    }

    @Test
    void search_clampsTopK() {
        when(embeddingService.embedAsVectorString(anyString())).thenReturn("[0,0,0]");
        when(chunkRepository.searchByCosineSimilarity(anyString(), any(), anyInt()))
                .thenReturn(List.of());

        service.search("query", 1L, 100);
        verify(chunkRepository).searchByCosineSimilarity(anyString(), eq(1L), eq(20));

        service.search("query", 1L, 0);
        verify(chunkRepository).searchByCosineSimilarity(anyString(), eq(1L), eq(1));
    }

    @Test
    void search_embeddingFailure_returnsEmpty() {
        when(embeddingService.embedAsVectorString(anyString()))
                .thenThrow(new EmbeddingProvider.EmbeddingException("API down"));

        List<KbSearchService.KbSearchHit> hits = service.search("test", 1L, 5);
        assertTrue(hits.isEmpty());
        verifyNoInteractions(chunkRepository);
    }

    @Test
    void search_dbFailure_returnsEmpty() {
        when(embeddingService.embedAsVectorString(anyString())).thenReturn("[0,0,0]");
        when(chunkRepository.searchByCosineSimilarity(anyString(), any(), anyInt()))
                .thenThrow(new RuntimeException("DB down"));

        List<KbSearchService.KbSearchHit> hits = service.search("test", 1L, 5);
        assertTrue(hits.isEmpty());
    }

    @Test
    void search_truncatesLongSnippet() {
        when(embeddingService.embedAsVectorString(anyString())).thenReturn("[0,0,0]");
        String longContent = "x".repeat(500);
        List<Object[]> rows = new java.util.ArrayList<>();
        rows.add(new Object[]{1L, longContent, "doc.md", "T", 1L, 0.0d});
        when(chunkRepository.searchByCosineSimilarity(anyString(), any(), anyInt())).thenReturn(rows);

        List<KbSearchService.KbSearchHit> hits = service.search("test", 1L, 1);
        assertEquals(1, hits.size());
        assertTrue(hits.get(0).snippet().length() <= 280,
                "Snippet doit etre tronque a SNIPPET_MAX_CHARS");
        assertTrue(hits.get(0).snippet().endsWith("…"));
    }

    @Test
    void search_relevanceClampedTo01() {
        when(embeddingService.embedAsVectorString(anyString())).thenReturn("[0,0,0]");
        // distance 3.0 → relevance theorique -0.5 → clamp a 0
        List<Object[]> rows = new java.util.ArrayList<>();
        rows.add(new Object[]{1L, "txt", "doc.md", "T", 1L, 3.0d});
        when(chunkRepository.searchByCosineSimilarity(anyString(), any(), anyInt())).thenReturn(rows);

        List<KbSearchService.KbSearchHit> hits = service.search("test", 1L, 1);
        assertEquals(0.0, hits.get(0).relevance(), 0.001);
    }

    // ─── Rerank pipeline (2 phases) ──────────────────────────────────────

    @Test
    void rerankActive_overFetchesAndReorders() {
        when(rerankService.isActive()).thenReturn(true);
        when(rerankService.getOverFetchFactor()).thenReturn(4);
        when(embeddingService.embedAsVectorString(anyString())).thenReturn("[0,0,0]");

        // Phase 1 : fetch 20 chunks (topK=5 × factor=4) avec distances croissantes
        List<Object[]> rows = new java.util.ArrayList<>();
        for (int i = 0; i < 20; i++) {
            rows.add(new Object[]{(long) i, "content " + i, "doc.md", "T" + i, (long) i, i * 0.05d});
        }
        when(chunkRepository.searchByCosineSimilarity(anyString(), any(), anyInt())).thenReturn(rows);

        // Phase 2 : le rerank reorganise → indices 10, 3, 7, 0, 15 (5 elements)
        when(rerankService.rerank(eq("test"), org.mockito.ArgumentMatchers.anyList(), eq(5)))
                .thenReturn(List.of(10, 3, 7, 0, 15));

        List<KbSearchService.KbSearchHit> hits = service.search("test", 1L, 5);

        assertEquals(5, hits.size());
        // Verify l'ordre rerank est applique
        assertEquals("T10", hits.get(0).title());
        assertEquals("T3", hits.get(1).title());
        assertEquals("T7", hits.get(2).title());

        // Verify la phase 1 a bien over-fetch
        org.mockito.ArgumentCaptor<Integer> kCap = org.mockito.ArgumentCaptor.forClass(Integer.class);
        verify(chunkRepository).searchByCosineSimilarity(anyString(), any(), kCap.capture());
        assertEquals(20, kCap.getValue().intValue());
    }

    @Test
    void rerankInactive_fetchesExactlyTopK_skipsReranking() {
        when(rerankService.isActive()).thenReturn(false);
        when(embeddingService.embedAsVectorString(anyString())).thenReturn("[0,0,0]");

        List<Object[]> rows = new java.util.ArrayList<>();
        rows.add(new Object[]{1L, "c1", "doc.md", "T1", 1L, 0.1d});
        rows.add(new Object[]{2L, "c2", "doc.md", "T2", 2L, 0.2d});
        when(chunkRepository.searchByCosineSimilarity(anyString(), any(), anyInt())).thenReturn(rows);

        List<KbSearchService.KbSearchHit> hits = service.search("test", 1L, 5);

        assertEquals(2, hits.size());
        // Ordre cosine preserve
        assertEquals("T1", hits.get(0).title());
        verify(rerankService, never()).rerank(any(), any(), anyInt());
    }

    @Test
    void rerankReturnsEmpty_fallsBackToCosineOrder() {
        when(rerankService.isActive()).thenReturn(true);
        when(rerankService.getOverFetchFactor()).thenReturn(4);
        when(embeddingService.embedAsVectorString(anyString())).thenReturn("[0,0,0]");

        List<Object[]> rows = new java.util.ArrayList<>();
        rows.add(new Object[]{1L, "c1", "doc.md", "T1", 1L, 0.1d});
        rows.add(new Object[]{2L, "c2", "doc.md", "T2", 2L, 0.3d});
        when(chunkRepository.searchByCosineSimilarity(anyString(), any(), anyInt())).thenReturn(rows);
        // Rerank renvoie liste vide (echec interne)
        when(rerankService.rerank(any(), any(), anyInt())).thenReturn(List.of());

        List<KbSearchService.KbSearchHit> hits = service.search("test", 1L, 5);

        // Fallback : ordre cosine preserve
        assertEquals(2, hits.size());
        assertEquals("T1", hits.get(0).title());
    }

    @Test
    void rerank_candidatesSizeBelowTopK_skipsRerank() {
        when(rerankService.isActive()).thenReturn(true);
        when(rerankService.getOverFetchFactor()).thenReturn(4);
        when(embeddingService.embedAsVectorString(anyString())).thenReturn("[0,0,0]");

        // Phase 1 retourne 3 chunks, topK demande = 5 → pas la peine de rerank
        List<Object[]> rows = new java.util.ArrayList<>();
        for (int i = 0; i < 3; i++) {
            rows.add(new Object[]{(long) i, "c" + i, "doc.md", "T" + i, (long) i, i * 0.1d});
        }
        when(chunkRepository.searchByCosineSimilarity(anyString(), any(), anyInt())).thenReturn(rows);

        service.search("test", 1L, 5);
        verify(rerankService, never()).rerank(any(), any(), anyInt());
    }

    @Test
    void computeFetchSize_clampedToMaxFetch() {
        when(rerankService.isActive()).thenReturn(true);
        when(rerankService.getOverFetchFactor()).thenReturn(10);

        // topK 20 × 10 = 200 → clamp a 80 (MAX_FETCH)
        assertEquals(80, service.computeFetchSize(20));
        // topK 5 × 10 = 50 → reste 50 (< 80)
        assertEquals(50, service.computeFetchSize(5));
    }
}
