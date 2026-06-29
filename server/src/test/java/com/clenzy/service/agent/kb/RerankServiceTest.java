package com.clenzy.service.agent.kb;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class RerankServiceTest {

    /**
     * Fake provider qui retourne les indices dans l'ordre inverse — facile a
     * verifier (rerank actif → ordre [n-1, n-2, ..., 0]).
     */
    private static class ReverseProvider implements RerankProvider {
        @Override
        public List<Integer> rerank(String query, List<String> documents, int topK) {
            int n = Math.min(topK, documents.size());
            return java.util.stream.IntStream.range(0, n)
                    .map(i -> documents.size() - 1 - i)
                    .boxed().toList();
        }
        @Override public String name() { return "reverse"; }
    }

    private static class FailingProvider implements RerankProvider {
        @Override public List<Integer> rerank(String q, List<String> d, int k) {
            throw new RerankException("boom");
        }
        @Override public String name() { return "failing"; }
    }

    @Test
    void selects_named_provider() {
        NoOpRerankProvider noOp = new NoOpRerankProvider();
        ReverseProvider reverse = new ReverseProvider();
        RerankService service = new RerankService(
                List.of(noOp, reverse), noOp, true, "reverse", 4);

        assertTrue(service.isActive());
        assertEquals("reverse", service.activeProviderName());

        List<Integer> result = service.rerank("q", List.of("a", "b", "c"), 3);
        assertEquals(List.of(2, 1, 0), result);
    }

    @Test
    void enabled_false_uses_noop_fallback() {
        NoOpRerankProvider noOp = new NoOpRerankProvider();
        RerankService service = new RerankService(
                List.of(noOp, new ReverseProvider()), noOp, false, "reverse", 4);

        assertFalse(service.isActive());
        List<Integer> result = service.rerank("q", List.of("a", "b", "c"), 3);
        // NoOp preserve l'ordre
        assertEquals(List.of(0, 1, 2), result);
    }

    @Test
    void unknown_provider_falls_back_to_noop() {
        NoOpRerankProvider noOp = new NoOpRerankProvider();
        RerankService service = new RerankService(
                List.of(noOp), noOp, true, "unknown-provider", 4);
        assertFalse(service.isActive(), "fallback noop → inactive");
        assertEquals("noop", service.activeProviderName());
    }

    @Test
    void provider_unavailable_falls_back_to_noop() {
        NoOpRerankProvider noOp = new NoOpRerankProvider();
        RerankProvider unavailable = new RerankProvider() {
            @Override public List<Integer> rerank(String q, List<String> d, int k) { return List.of(); }
            @Override public String name() { return "voyage"; }
            @Override public boolean isAvailable() { return false; }
        };
        RerankService service = new RerankService(
                List.of(noOp, unavailable), noOp, true, "voyage", 4);
        // Disponibilite resolue a l'appel (config DB) : le provider reste "voyage" (choisi par nom)
        // mais isActive() est false car indisponible, et rerank degrade en NoOp (ordre d'entree).
        assertFalse(service.isActive());
        assertEquals("voyage", service.activeProviderName());
        assertEquals(List.of(0, 1), service.rerank("q", List.of("a", "b", "c"), 2));
    }

    @Test
    void provider_throws_falls_back_silently() {
        NoOpRerankProvider noOp = new NoOpRerankProvider();
        FailingProvider failing = new FailingProvider();
        RerankService service = new RerankService(
                List.of(noOp, failing), noOp, true, "failing", 4);

        // Active provider est "failing" → rerank doit catch et fallback noop
        assertTrue(service.isActive());
        List<Integer> result = service.rerank("q", List.of("a", "b"), 2);
        assertEquals(List.of(0, 1), result);
    }

    @Test
    void empty_docs_returns_empty() {
        NoOpRerankProvider noOp = new NoOpRerankProvider();
        RerankService service = new RerankService(
                List.of(noOp), noOp, true, "noop", 4);
        assertTrue(service.rerank("q", null, 5).isEmpty());
        assertTrue(service.rerank("q", List.of(), 5).isEmpty());
    }

    @Test
    void over_fetch_factor_clamped() {
        NoOpRerankProvider noOp = new NoOpRerankProvider();
        // Below min
        RerankService low = new RerankService(List.of(noOp), noOp, true, "noop", -5);
        assertEquals(1, low.getOverFetchFactor());
        // Above max
        RerankService high = new RerankService(List.of(noOp), noOp, true, "noop", 99);
        assertEquals(10, high.getOverFetchFactor());
        // Normal
        RerankService normal = new RerankService(List.of(noOp), noOp, true, "noop", 5);
        assertEquals(5, normal.getOverFetchFactor());
    }

    @Test
    void noop_provider_truncates_to_topK() {
        NoOpRerankProvider noOp = new NoOpRerankProvider();
        List<Integer> result = noOp.rerank("q", List.of("a", "b", "c", "d"), 2);
        assertEquals(List.of(0, 1), result);
    }
}
