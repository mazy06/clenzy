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
        lenient().when(p.embed(any(), any(), any())).thenReturn(vector);
        lenient().when(p.embedBatch(anyList(), any(), any())).thenAnswer(inv -> {
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
    void embedQueryAsVectorString_resolvesProviderFromDbConfig_andUsesQueryKind() {
        float[] vec = {0.0f, 0.001f, 0.002f};
        EmbeddingProvider voyage = provider("voyage", vec);
        EmbeddingProvider openai = provider("openai", new float[]{9f});
        PlatformAiConfigService config = configWith(
                Optional.of(model("voyage", "voyage-3-large", "k", AiModelAvailability.AVAILABLE)));

        EmbeddingService service = new EmbeddingService(List.of(voyage, openai), config, null, 0.7);

        String result = service.embedQueryAsVectorString("hello");

        // Le provider resolu (voyage) recoit la cible construite depuis le modele DB
        // et le kind QUERY (retrieval asymetrique).
        assertEquals(EmbeddingService.toPgVectorString(vec), result);
        verify(voyage).embed(eq("hello"), any(EmbeddingProvider.EmbeddingTarget.class),
                eq(EmbeddingProvider.InputKind.QUERY));
        verify(openai, never()).embed(any(), any(), any());
    }

    @Test
    void embedDocumentAsVectorString_usesDocumentKind() {
        float[] vec = {1.0f};
        EmbeddingProvider voyage = provider("voyage", vec);
        PlatformAiConfigService config = configWith(
                Optional.of(model("voyage", "voyage-3-large", "k", AiModelAvailability.AVAILABLE)));

        EmbeddingService service = new EmbeddingService(List.of(voyage), config, null, 0.7);

        service.embedDocumentAsVectorString("chunk");

        verify(voyage).embed(eq("chunk"), any(EmbeddingProvider.EmbeddingTarget.class),
                eq(EmbeddingProvider.InputKind.DOCUMENT));
    }

    @Test
    void embedBatchAsVectorStrings_returnsListAligned_withDocumentKind() {
        float[] vec = {1.0f, 2.0f};
        EmbeddingProvider openai = provider("openai", vec);
        PlatformAiConfigService config = configWith(
                Optional.of(model("openai", "text-embedding-3-large", "k", AiModelAvailability.AVAILABLE)));

        EmbeddingService service = new EmbeddingService(List.of(openai), config, null, 0.7);

        List<String> result = service.embedBatchAsVectorStrings(List.of("a", "b", "c"));

        assertEquals(3, result.size());
        String expected = EmbeddingService.toPgVectorString(vec);
        result.forEach(s -> assertEquals(expected, s));
        verify(openai).embedBatch(eq(List.of("a", "b", "c")),
                any(EmbeddingProvider.EmbeddingTarget.class),
                eq(EmbeddingProvider.InputKind.DOCUMENT));
    }

    @Test
    void noModelConfigured_throwsEmbeddingException() {
        EmbeddingProvider voyage = provider("voyage", new float[]{1f});
        PlatformAiConfigService config = configWith(Optional.empty());

        EmbeddingService service = new EmbeddingService(List.of(voyage), config, null, 0.7);

        assertThrows(EmbeddingProvider.EmbeddingException.class,
                () -> service.embedQueryAsVectorString("hello"));
        assertThrows(EmbeddingProvider.EmbeddingException.class,
                () -> service.embedBatchAsVectorStrings(List.of("a")));
        assertFalse(service.isConfigured());
        verify(voyage, never()).embed(any(), any(), any());
    }

    @Test
    void modelMarkedUnavailable_throwsEmbeddingException() {
        EmbeddingProvider voyage = provider("voyage", new float[]{1f});
        PlatformAiConfigService config = configWith(
                Optional.of(model("voyage", "voyage-3-large", "k", AiModelAvailability.UNAVAILABLE)));

        EmbeddingService service = new EmbeddingService(List.of(voyage), config, null, 0.7);

        assertThrows(EmbeddingProvider.EmbeddingException.class,
                () -> service.embedQueryAsVectorString("hello"));
        assertFalse(service.isConfigured());
        verify(voyage, never()).embed(any(), any(), any());
    }

    @Test
    void modelWithBlankApiKey_throwsEmbeddingException() {
        EmbeddingProvider voyage = provider("voyage", new float[]{1f});
        PlatformAiConfigService config = configWith(
                Optional.of(model("voyage", "voyage-3-large", "  ", AiModelAvailability.AVAILABLE)));

        EmbeddingService service = new EmbeddingService(List.of(voyage), config, null, 0.7);

        assertThrows(EmbeddingProvider.EmbeddingException.class,
                () -> service.embedQueryAsVectorString("hello"));
        verify(voyage, never()).embed(any(), any(), any());
    }

    @Test
    void providerWithoutImplementation_throwsEmbeddingException() {
        EmbeddingProvider voyage = provider("voyage", new float[]{1f});
        // Le modele DB pointe vers un provider ("inconnu") sans implementation enregistree.
        PlatformAiConfigService config = configWith(
                Optional.of(model("inconnu", "some-model", "k", AiModelAvailability.AVAILABLE)));

        EmbeddingService service = new EmbeddingService(List.of(voyage), config, null, 0.7);

        assertThrows(EmbeddingProvider.EmbeddingException.class,
                () -> service.embedQueryAsVectorString("hello"));
        verify(voyage, never()).embed(any(), any(), any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void embedQuery_cachesVectorInRedis_secondCallSkipsProvider() {
        float[] vec = {0.5f};
        EmbeddingProvider voyage = provider("voyage", vec);
        PlatformAiConfigService config = configWith(
                Optional.of(model("voyage", "voyage-3-large", "k", AiModelAvailability.AVAILABLE)));

        var redis = mock(org.springframework.data.redis.core.StringRedisTemplate.class);
        var values = mock(org.springframework.data.redis.core.ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        var redisProvider = mock(org.springframework.beans.factory.ObjectProvider.class);
        when(redisProvider.getIfAvailable()).thenReturn(redis);

        // 1er appel : cache vide → provider appele + mise en cache
        when(values.get(anyString())).thenReturn(null);
        EmbeddingService service = new EmbeddingService(List.of(voyage), config,
                (org.springframework.beans.factory.ObjectProvider<org.springframework.data.redis.core.StringRedisTemplate>) redisProvider,
                0.7);
        String first = service.embedQueryAsVectorString("comment baisser mes prix");
        verify(voyage, times(1)).embed(any(), any(), any());
        verify(values).set(anyString(), eq(first), any(java.time.Duration.class));

        // 2e appel : cache hit → aucun nouvel appel provider
        when(values.get(anyString())).thenReturn(first);
        String second = service.embedQueryAsVectorString("comment baisser mes prix");
        assertEquals(first, second);
        verify(voyage, times(1)).embed(any(), any(), any());
    }

    @Test
    void isConfigured_trueWhenModelExploitable() {
        EmbeddingProvider voyage = provider("voyage", new float[]{1f});
        PlatformAiConfigService config = configWith(
                Optional.of(model("voyage", "voyage-3-large", "k", AiModelAvailability.AVAILABLE)));
        EmbeddingService service = new EmbeddingService(List.of(voyage), config, null, 0.7);
        assertTrue(service.isConfigured());
    }

    @Test
    void dimensions_isFixedAt1024() {
        PlatformAiConfigService config = configWith(Optional.empty());
        EmbeddingService service = new EmbeddingService(List.of(), config, null, 0.7);
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
    void relevanceThreshold_isPassedThrough() {
        PlatformAiConfigService config = configWith(Optional.empty());
        EmbeddingService service = new EmbeddingService(List.of(provider("voyage", new float[]{1f})), config, null, 0.85);
        assertEquals(0.85, service.getRelevanceThreshold(), 1e-9);
    }
}
