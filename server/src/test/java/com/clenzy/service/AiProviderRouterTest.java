package com.clenzy.service;

import com.clenzy.config.ai.AiRequest;
import com.clenzy.config.ai.AiResponse;
import com.clenzy.config.ai.AnthropicProvider;
import com.clenzy.config.ai.BedrockProvider;
import com.clenzy.config.ai.OpenAiProvider;
import com.clenzy.model.AiFeature;
import com.clenzy.service.AiKeyResolver.KeySource;
import com.clenzy.service.AiKeyResolver.ResolvedKey;
import com.clenzy.service.AiProviderRouter.RoutedResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AiProviderRouterTest {

    @Mock private AiKeyResolver aiKeyResolver;
    @Mock private OpenAiProvider openAiProvider;
    @Mock private AnthropicProvider anthropicProvider;
    @Mock private BedrockProvider bedrockProvider;

    private AiProviderRouter router;

    @BeforeEach
    void setUp() {
        router = new AiProviderRouter(aiKeyResolver, openAiProvider, anthropicProvider, bedrockProvider);
        when(openAiProvider.name()).thenReturn("openai");
        when(anthropicProvider.name()).thenReturn("anthropic");
        when(bedrockProvider.name()).thenReturn("bedrock");
    }

    private AiResponse aiResponse(String text) {
        return new AiResponse(text, 10, 20, 30, "model-x", "stop");
    }

    private AiRequest aiRequest() {
        return AiRequest.of("system", "hello");
    }

    @Nested
    @DisplayName("route - ORGANIZATION source")
    class OrganizationRoute {

        @Test
        @DisplayName("uses provider.chat(request, apiKey) for org BYOK keys")
        void orgKey_usesBYOKMethod() {
            ResolvedKey key = new ResolvedKey("sk-org-key", null, KeySource.ORGANIZATION);
            when(aiKeyResolver.resolve(eq(1L), eq("openai"), any())).thenReturn(key);
            when(openAiProvider.chat(any(AiRequest.class), eq("sk-org-key"))).thenReturn(aiResponse("hi"));

            RoutedResponse result = router.route(1L, "openai", aiRequest());

            assertThat(result.providerName()).isEqualTo("openai");
            assertThat(result.source()).isEqualTo(KeySource.ORGANIZATION);
            assertThat(result.response().content()).isEqualTo("hi");
            verify(openAiProvider).chat(any(AiRequest.class), eq("sk-org-key"));
        }

        @Test
        @DisplayName("applies modelOverride when present")
        void orgKey_appliesModelOverride() {
            ResolvedKey key = new ResolvedKey("sk-org-key", "gpt-4o", KeySource.ORGANIZATION);
            when(aiKeyResolver.resolve(eq(1L), eq("openai"), any())).thenReturn(key);
            when(openAiProvider.chat(any(AiRequest.class), eq("sk-org-key"))).thenReturn(aiResponse("ok"));

            router.route(1L, "openai", aiRequest());

            ArgumentCaptor<AiRequest> captor = ArgumentCaptor.forClass(AiRequest.class);
            verify(openAiProvider).chat(captor.capture(), eq("sk-org-key"));
            assertThat(captor.getValue().model()).isEqualTo("gpt-4o");
        }
    }

    @Nested
    @DisplayName("route - PLATFORM env source")
    class PlatformEnvRoute {

        @Test
        @DisplayName("uses provider.chat(request) without apiKey")
        void platformEnv_usesDefaultChat() {
            ResolvedKey key = new ResolvedKey("env-key", null, KeySource.PLATFORM);
            when(aiKeyResolver.resolve(eq(1L), eq("openai"), any())).thenReturn(key);
            when(openAiProvider.chat(any(AiRequest.class))).thenReturn(aiResponse("ok"));

            RoutedResponse result = router.route(1L, "openai", aiRequest());

            assertThat(result.source()).isEqualTo(KeySource.PLATFORM);
            verify(openAiProvider).chat(any(AiRequest.class));
            verify(openAiProvider, never()).chat(any(AiRequest.class), any(String.class));
        }

        @Test
        @DisplayName("routes anthropic provider")
        void platformEnv_anthropic() {
            ResolvedKey key = new ResolvedKey("env-anthropic", null, KeySource.PLATFORM);
            when(aiKeyResolver.resolve(eq(1L), eq("anthropic"), any())).thenReturn(key);
            when(anthropicProvider.chat(any(AiRequest.class))).thenReturn(aiResponse("a"));

            RoutedResponse result = router.route(1L, "anthropic", aiRequest());

            assertThat(result.providerName()).isEqualTo("anthropic");
            verify(anthropicProvider).chat(any(AiRequest.class));
        }

        @Test
        @DisplayName("routes bedrock provider")
        void platformEnv_bedrock() {
            ResolvedKey key = new ResolvedKey("env-bedrock", null, KeySource.PLATFORM);
            when(aiKeyResolver.resolve(eq(1L), eq("bedrock"), any())).thenReturn(key);
            when(bedrockProvider.chat(any(AiRequest.class))).thenReturn(aiResponse("b"));

            RoutedResponse result = router.route(1L, "bedrock", aiRequest());

            assertThat(result.providerName()).isEqualTo("bedrock");
        }

        @Test
        @DisplayName("throws when unknown provider requested")
        void unknownProvider_throws() {
            ResolvedKey key = new ResolvedKey("env-key", null, KeySource.PLATFORM);
            when(aiKeyResolver.resolve(eq(1L), eq("mystery"), any())).thenReturn(key);

            assertThatThrownBy(() -> router.route(1L, "mystery", aiRequest()))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Unknown AI provider");
        }
    }

    @Nested
    @DisplayName("route - PLATFORM_DB source")
    class PlatformDbRoute {

        @Test
        @DisplayName("routes anthropic via apiKey + baseUrl")
        void anthropicEffectiveProvider() {
            ResolvedKey key = new ResolvedKey("db-key", "claude-3", KeySource.PLATFORM_DB,
                    "anthropic", "https://api.anthropic.com");
            when(aiKeyResolver.resolve(eq(1L), eq("openai"), any())).thenReturn(key);
            when(anthropicProvider.chat(any(AiRequest.class), eq("db-key"), eq("https://api.anthropic.com")))
                    .thenReturn(aiResponse("ok"));

            RoutedResponse result = router.route(1L, "openai", aiRequest());

            assertThat(result.providerName()).isEqualTo("anthropic");
            assertThat(result.source()).isEqualTo(KeySource.PLATFORM_DB);
            verify(anthropicProvider).chat(any(AiRequest.class), eq("db-key"), eq("https://api.anthropic.com"));
        }

        @Test
        @DisplayName("routes openai-compatible provider via bedrockProvider")
        void openaiCompatibleViaBedrock() {
            ResolvedKey key = new ResolvedKey("db-key", "nvidia-model", KeySource.PLATFORM_DB,
                    "nvidia", "https://integrate.api.nvidia.com");
            when(aiKeyResolver.resolve(eq(1L), eq("openai"), any())).thenReturn(key);
            when(bedrockProvider.chat(any(AiRequest.class), eq("db-key"),
                    eq("https://integrate.api.nvidia.com"), eq("nvidia"))).thenReturn(aiResponse("ok"));

            RoutedResponse result = router.route(1L, "openai", aiRequest());

            assertThat(result.providerName()).isEqualTo("nvidia");
        }

        @Test
        @DisplayName("applies modelOverride when present")
        void platformDb_appliesModelOverride() {
            ResolvedKey key = new ResolvedKey("db-key", "claude-3-haiku", KeySource.PLATFORM_DB,
                    "anthropic", null);
            when(aiKeyResolver.resolve(eq(1L), eq("anthropic"), any())).thenReturn(key);
            when(anthropicProvider.chat(any(AiRequest.class), eq("db-key"), any()))
                    .thenReturn(aiResponse("ok"));

            router.route(1L, "anthropic", aiRequest());

            ArgumentCaptor<AiRequest> captor = ArgumentCaptor.forClass(AiRequest.class);
            verify(anthropicProvider).chat(captor.capture(), eq("db-key"), any());
            assertThat(captor.getValue().model()).isEqualTo("claude-3-haiku");
        }
    }

    @Nested
    @DisplayName("resolveKey")
    class ResolveKey {

        @Test
        @DisplayName("delegates to AiKeyResolver without feature")
        void delegates() {
            ResolvedKey key = new ResolvedKey("k", null, KeySource.PLATFORM);
            when(aiKeyResolver.resolve(1L, "openai")).thenReturn(key);

            assertThat(router.resolveKey(1L, "openai")).isSameAs(key);
        }

        @Test
        @DisplayName("delegates to AiKeyResolver with feature")
        void delegatesWithFeature() {
            ResolvedKey key = new ResolvedKey("k", null, KeySource.PLATFORM);
            when(aiKeyResolver.resolve(1L, "openai", AiFeature.PRICING))
                    .thenReturn(key);

            assertThat(router.resolveKey(1L, "openai", AiFeature.PRICING))
                    .isSameAs(key);
        }
    }

    @Nested
    @DisplayName("route(orgId, provider, feature, request) - with feature")
    class RouteWithFeature {

        @Test
        @DisplayName("forwards feature to key resolver")
        void forwardsFeature() {
            ResolvedKey key = new ResolvedKey("k", null, KeySource.PLATFORM);
            when(aiKeyResolver.resolve(eq(1L), eq("openai"), eq(AiFeature.PRICING)))
                    .thenReturn(key);
            when(openAiProvider.chat(any(AiRequest.class))).thenReturn(aiResponse("ok"));

            router.route(1L, "openai", AiFeature.PRICING, aiRequest());

            verify(aiKeyResolver).resolve(eq(1L), eq("openai"), eq(AiFeature.PRICING));
        }
    }
}
