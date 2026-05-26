package com.clenzy.service.agent.kb;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EmbeddingServiceTest {

    private static class FakeProvider implements EmbeddingProvider {
        private final String name;
        private final int dims;
        FakeProvider(String name, int dims) { this.name = name; this.dims = dims; }

        @Override public String name() { return name; }
        @Override public int dimensions() { return dims; }
        @Override public float[] embed(String text) {
            float[] v = new float[dims];
            for (int i = 0; i < dims; i++) v[i] = (float) (i * 0.001);
            return v;
        }
        @Override public List<float[]> embedBatch(List<String> texts) {
            return texts.stream().map(this::embed).toList();
        }
    }

    @Test
    void selects_provider_by_name() {
        FakeProvider voyage = new FakeProvider("voyage", 1024);
        FakeProvider openai = new FakeProvider("openai", 1024);
        EmbeddingService service = new EmbeddingService(
                List.of(voyage, openai), "openai", false, 0.7);
        assertEquals("openai", service.getProvider().name());
        assertEquals(1024, service.dimensions());
    }

    @Test
    void unknown_provider_falls_back_to_first() {
        FakeProvider voyage = new FakeProvider("voyage", 1024);
        EmbeddingService service = new EmbeddingService(
                List.of(voyage), "cohere-unknown", false, 0.7);
        assertEquals("voyage", service.getProvider().name());
    }

    @Test
    void empty_providers_list_setsNull() {
        EmbeddingService service = new EmbeddingService(List.of(), "voyage", false, 0.7);
        assertNull(service.getProvider());
        assertThrows(EmbeddingProvider.EmbeddingException.class,
                () -> service.embedAsVectorString("hello"));
    }

    @Test
    void embedAsVectorString_returnsPgvectorFormat() {
        FakeProvider voyage = new FakeProvider("voyage", 3);
        EmbeddingService service = new EmbeddingService(List.of(voyage), "voyage", false, 0.7);

        String vec = service.embedAsVectorString("hello");
        // FakeProvider donne [0.0, 0.001, 0.002]
        assertTrue(vec.startsWith("["));
        assertTrue(vec.endsWith("]"));
        // Format pgvector : virgules + locale ROOT (point decimal)
        assertTrue(vec.contains(","));
        assertFalse(vec.contains(",,"));
    }

    @Test
    void toPgVectorString_handlesEmptyAndPrecision() {
        assertEquals("[]", EmbeddingService.toPgVectorString(null));
        assertEquals("[]", EmbeddingService.toPgVectorString(new float[0]));

        float[] v = new float[]{1.0f, -0.5f, 3.14159f};
        String s = EmbeddingService.toPgVectorString(v);
        // 6 decimales, point decimal, virgules
        assertTrue(s.startsWith("[1.000000,-0.500000,"));
        assertTrue(s.endsWith("]"));
    }

    @Test
    void embedBatchAsVectorStrings_returnsListAligned() {
        FakeProvider voyage = new FakeProvider("voyage", 2);
        EmbeddingService service = new EmbeddingService(List.of(voyage), "voyage", false, 0.7);

        List<String> result = service.embedBatchAsVectorStrings(List.of("a", "b", "c"));
        assertEquals(3, result.size());
        result.forEach(s -> {
            assertTrue(s.startsWith("["));
            assertTrue(s.endsWith("]"));
        });
    }

    @Test
    void relevanceThreshold_andAutoIngestionFlag_arePassedThrough() {
        EmbeddingService service = new EmbeddingService(
                List.of(new FakeProvider("voyage", 1024)), "voyage", true, 0.85);
        assertTrue(service.isAutoIngestionEnabled());
        assertEquals(0.85, service.getRelevanceThreshold(), 1e-9);
    }
}
