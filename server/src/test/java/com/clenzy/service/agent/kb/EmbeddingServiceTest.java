package com.clenzy.service.agent.kb;

import com.clenzy.model.AiFeature;
import com.clenzy.model.AiModelAvailability;
import com.clenzy.model.PlatformAiModel;
import com.clenzy.service.PlatformAiConfigService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

class EmbeddingServiceTest {

    private static final String EMBEDDINGS = AiFeature.EMBEDDINGS.name();

    /** Mock d'un modele EMBEDDINGS configure dans la config DB plateforme. */
    private static PlatformAiModel model(String provider, String modelId, String apiKey,
                                         AiModelAvailability availability) {
        PlatformAiModel m = mock(PlatformAiModel.class);
        lenient().when(m.getProvider()).thenReturn(provider);
        lenient().when(m.getModelId()).thenReturn(modelId);
        lenient().when(m.getApiKey()).thenReturn(apiKey);
        lenient().when(m.getBaseUrl()).thenReturn(null);
        lenient().when(m.getAvailabilityStatus()).thenReturn(availability);
        return m;
    }

    /** Mock d'un provider d'embeddings dont {@code embed/embedBatch} renvoie un vecteur connu. */
    private static EmbeddingProvider provider(String name, float[] vector) {
        EmbeddingProvider p = mock(EmbeddingProvider.class);
        when(p.name()).thenReturn(name);
        lenient().when(p.embed(any(), any())).thenReturn(vector);
        lenient().when(p.embedBatch(anyList(), any())).thenAnswer(inv -> {
            List<String> texts = inv.getArgument(0);
            return texts.stream().map(t -> vector).toList();
        });
        return p;
    }

    private static PlatformAiConfigService configWith(Optional<PlatformAiModel> active) {
        PlatformAiConfigService svc = mock(PlatformAiConfigService.class);
        when(svc.getActiveModelForFeature(EMBEDDINGS)).thenReturn(active);
        return svc;
    }

    @Test
    void embedAsVectorString_resolvesProviderFromDbConfig_andReturnsPgvectorFormat() {
        float[] vec = {0.0f, 0.001f, 0.002f};
        EmbeddingProvider voyage = provider("voyage", vec);
        EmbeddingProvider openai = provider("openai", new float[]{9f});
        PlatformAiConfigService config = configWith(
                Optional.of(model("voyage", "voyage-3-lite", "k", AiModelAvailability.AVAILABLE)));

        EmbeddingService service = new EmbeddingService(
                List.of(voyage, openai), config, false, 0.7);

        String result = service.embedAsVectorString("hello");

        // Le provider resolu (voyage) recoit la cible construite depuis le modele DB.
        assertEquals(EmbeddingService.toPgVectorString(vec), result);
        verify(voyage).embed(eq("hello"), any(EmbeddingProvider.EmbeddingTarget.class));
        verify(openai, never()).embed(any(), any());
    }

    @Test
    void embedBatchAsVectorStrings_returnsListAligned() {
        float[] vec = {1.0f, 2.0f};
        EmbeddingProvider openai = provider("openai", vec);
        PlatformAiConfigService config = configWith(
                Optional.of(model("openai", "text-embedding-3-small", "k", AiModelAvailability.AVAILABLE)));

        EmbeddingService service = new EmbeddingService(List.of(openai), config, false, 0.7);

        List<String> result = service.embedBatchAsVectorStrings(List.of("a", "b", "c"));

        assertEquals(3, result.size());
        String expected = EmbeddingService.toPgVectorString(vec);
        result.forEach(s -> assertEquals(expected, s));
        verify(openai).embedBatch(eq(List.of("a", "b", "c")), any(EmbeddingProvider.EmbeddingTarget.class));
    }

    @Test
    void noModelConfigured_throwsEmbeddingException() {
        EmbeddingProvider voyage = provider("voyage", new float[]{1f});
        PlatformAiConfigService config = configWith(Optional.empty());

        EmbeddingService service = new EmbeddingService(List.of(voyage), config, false, 0.7);

        assertThrows(EmbeddingProvider.EmbeddingException.class,
                () -> service.embedAsVectorString("hello"));
        assertThrows(EmbeddingProvider.EmbeddingException.class,
                () -> service.embedBatchAsVectorStrings(List.of("a")));
        verify(voyage, never()).embed(any(), any());
    }

    @Test
    void modelMarkedUnavailable_throwsEmbeddingException() {
        EmbeddingProvider voyage = provider("voyage", new float[]{1f});
        PlatformAiConfigService config = configWith(
                Optional.of(model("voyage", "voyage-3-lite", "k", AiModelAvailability.UNAVAILABLE)));

        EmbeddingService service = new EmbeddingService(List.of(voyage), config, false, 0.7);

        assertThrows(EmbeddingProvider.EmbeddingException.class,
                () -> service.embedAsVectorString("hello"));
        verify(voyage, never()).embed(any(), any());
    }

    @Test
    void modelWithBlankApiKey_throwsEmbeddingException() {
        EmbeddingProvider voyage = provider("voyage", new float[]{1f});
        PlatformAiConfigService config = configWith(
                Optional.of(model("voyage", "voyage-3-lite", "  ", AiModelAvailability.AVAILABLE)));

        EmbeddingService service = new EmbeddingService(List.of(voyage), config, false, 0.7);

        assertThrows(EmbeddingProvider.EmbeddingException.class,
                () -> service.embedAsVectorString("hello"));
        verify(voyage, never()).embed(any(), any());
    }

    @Test
    void providerWithoutImplementation_throwsEmbeddingException() {
        EmbeddingProvider voyage = provider("voyage", new float[]{1f});
        // Le modele DB pointe vers un provider ("inconnu") sans implementation enregistree.
        PlatformAiConfigService config = configWith(
                Optional.of(model("inconnu", "some-model", "k", AiModelAvailability.AVAILABLE)));

        EmbeddingService service = new EmbeddingService(List.of(voyage), config, false, 0.7);

        assertThrows(EmbeddingProvider.EmbeddingException.class,
                () -> service.embedAsVectorString("hello"));
        verify(voyage, never()).embed(any(), any());
    }

    @Test
    void dimensions_isFixedAt1024() {
        PlatformAiConfigService config = configWith(Optional.empty());
        EmbeddingService service = new EmbeddingService(List.of(), config, false, 0.7);
        assertEquals(1024, service.dimensions());
        assertEquals(EmbeddingService.VECTOR_DIMENSIONS, service.dimensions());
    }

    @Test
    void toPgVectorString_handlesEmptyAndPrecision() {
        assertEquals("[]", EmbeddingService.toPgVectorString(null));
        assertEquals("[]", EmbeddingService.toPgVectorString(new float[0]));

        float[] v = new float[]{1.0f, -0.5f, 3.14159f};
        String s = EmbeddingService.toPgVectorString(v);
        // 6 decimales, point decimal (locale ROOT), virgules
        assertTrue(s.startsWith("[1.000000,-0.500000,"));
        assertTrue(s.endsWith("]"));
    }

    @Test
    void relevanceThreshold_andAutoIngestionFlag_arePassedThrough() {
        PlatformAiConfigService config = configWith(Optional.empty());
        EmbeddingService service = new EmbeddingService(
                List.of(provider("voyage", new float[]{1f})), config, true, 0.85);
        assertTrue(service.isAutoIngestionEnabled());
        assertEquals(0.85, service.getRelevanceThreshold(), 1e-9);
    }
}
