package com.clenzy.service.agent.kb;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class KbRetrievalEvalServiceTest {

    @Mock private KbSearchService kbSearchService;
    @Mock private EmbeddingService embeddingService;

    private KbRetrievalEvalService service;

    @BeforeEach
    void setUp() {
        service = new KbRetrievalEvalService(kbSearchService, embeddingService, new ObjectMapper());
        when(embeddingService.isConfigured()).thenReturn(true);
    }

    private static KbSearchService.KbSearchHit hit(String sourcePath) {
        return new KbSearchService.KbSearchHit(1L, 1L, "t", sourcePath, "s", 0.9);
    }

    @Test
    void evaluate_computesRecallAndMrr_overRealGoldenSet() {
        // Toutes les questions trouvent leur doc attendu en rang 2 → recall 1.0, MRR 0.5
        when(kbSearchService.search(anyString(), isNull(), eq(KbRetrievalEvalService.TOP_K), eq("fr")))
                .thenAnswer(inv -> List.of(hit("autre.md"), hit(expectedFor(inv.getArgument(0)))));

        KbRetrievalEvalService.EvalReport report = service.evaluate();

        assertTrue(report.total() >= 30, "le golden set embarque doit etre charge");
        assertEquals(report.total(), report.hits());
        assertEquals(1.0, report.recallAtK(), 1e-9);
        assertEquals(0.5, report.mrr(), 1e-9);
    }

    @Test
    void evaluate_missesAreReported() {
        when(kbSearchService.search(anyString(), isNull(), anyInt(), eq("fr")))
                .thenReturn(List.of(hit("mauvais-doc.md")));

        KbRetrievalEvalService.EvalReport report = service.evaluate();

        assertEquals(0, report.hits());
        assertEquals(0.0, report.recallAtK(), 1e-9);
        assertEquals(0.0, report.mrr(), 1e-9);
        assertTrue(report.entries().stream().allMatch(e -> e.rank() == -1));
    }

    @Test
    void evaluate_withoutEmbeddingsModel_throwsExplicitly() {
        when(embeddingService.isConfigured()).thenReturn(false);
        IllegalStateException ex = assertThrows(IllegalStateException.class, service::evaluate);
        assertTrue(ex.getMessage().contains("Embeddings"));
    }

    /** Reconstruit le sourcePath attendu depuis la question via le golden set reel. */
    private String expectedFor(String question) {
        try (var in = getClass().getResourceAsStream("/kb-golden-set.json")) {
            var root = new ObjectMapper().readTree(in);
            for (var node : root) {
                if (node.path("question").asText().equals(question)) {
                    return node.path("expected").asText();
                }
            }
        } catch (Exception ignored) {}
        return "inconnu.md";
    }
}
