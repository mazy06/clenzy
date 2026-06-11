package com.clenzy.service.agent;

import com.clenzy.config.AiProperties;
import com.clenzy.model.AiFeature;
import com.clenzy.model.OrgAiApiKey;
import com.clenzy.model.PlatformAiModel;
import com.clenzy.repository.OrgAiApiKeyRepository;
import com.clenzy.service.PlatformAiConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests du {@link AssistantTargetResolver} (extrait de AgentOrchestrator —
 * meme precedence que l'ancien resolveAssistantTarget).
 */
class AssistantTargetResolverTest {

    private PlatformAiConfigService platformAiConfigService;
    private OrgAiApiKeyRepository keyRepo;
    private AiProperties aiProperties;
    private AssistantTargetResolver resolver;

    @BeforeEach
    void setUp() {
        platformAiConfigService = mock(PlatformAiConfigService.class);
        keyRepo = mock(OrgAiApiKeyRepository.class);
        aiProperties = new AiProperties();
        resolver = new AssistantTargetResolver(platformAiConfigService, keyRepo, aiProperties);

        when(platformAiConfigService.getActiveProviderForFeature(anyString()))
                .thenReturn(Optional.empty());
        when(platformAiConfigService.getActiveModelForFeature(anyString()))
                .thenReturn(Optional.empty());
        when(keyRepo.findByOrganizationIdAndProvider(anyLong(), anyString()))
                .thenReturn(Optional.empty());
    }

    /**
     * Instance reelle (pas un mock) : stubber un mock dans l'argument de
     * {@code thenReturn(...)} declenche un UnfinishedStubbingException Mockito.
     */
    private OrgAiApiKey validKey(String apiKey, String modelOverride) {
        OrgAiApiKey k = new OrgAiApiKey(1L, "test-provider", apiKey);
        k.setValid(true);
        k.setModelOverride(modelOverride);
        return k;
    }

    @Test
    void whenNothingConfigured_thenDefaultsToAnthropicPlatform() {
        // Act
        AssistantTargetResolver.ChatTarget target = resolver.resolve(1L, null);

        // Assert
        assertThat(target.provider()).isEqualTo("anthropic");
        assertThat(target.model()).isNull();
        assertThat(target.apiKey()).isNull();
        assertThat(target.baseUrl()).isNull();
    }

    @Test
    void whenAnthropicByokPresent_thenReturnsByokKeyAndModelOverride() {
        // Arrange
        when(keyRepo.findByOrganizationIdAndProvider(1L, "anthropic"))
                .thenReturn(Optional.of(validKey("sk-ant-byok", "claude-haiku")));

        // Act
        AssistantTargetResolver.ChatTarget target = resolver.resolve(1L, null);

        // Assert
        assertThat(target.provider()).isEqualTo("anthropic");
        assertThat(target.apiKey()).isEqualTo("sk-ant-byok");
        assertThat(target.model()).isEqualTo("claude-haiku");
    }

    @Test
    void whenProviderAssignedWithByok_thenByokTakesPrecedence() {
        // Arrange
        when(platformAiConfigService.getActiveProviderForFeature(AiFeature.ASSISTANT_CHAT.name()))
                .thenReturn(Optional.of("openai"));
        when(keyRepo.findByOrganizationIdAndProvider(1L, "openai"))
                .thenReturn(Optional.of(validKey("sk-openai-byok", "gpt-4o-mini")));

        // Act
        AssistantTargetResolver.ChatTarget target = resolver.resolve(1L, null);

        // Assert
        assertThat(target.provider()).isEqualTo("openai");
        assertThat(target.apiKey()).isEqualTo("sk-openai-byok");
        assertThat(target.model()).isEqualTo("gpt-4o-mini");
        assertThat(target.baseUrl()).isEqualTo(aiProperties.getOpenai().getBaseUrl());
    }

    @Test
    void whenProviderAssignedWithoutByok_thenUsesPlatformEnvKey() {
        // Arrange
        aiProperties.getOpenai().setApiKey("sk-openai-env");
        when(platformAiConfigService.getActiveProviderForFeature(AiFeature.ASSISTANT_CHAT.name()))
                .thenReturn(Optional.of("openai"));

        // Act
        AssistantTargetResolver.ChatTarget target = resolver.resolve(1L, null);

        // Assert
        assertThat(target.provider()).isEqualTo("openai");
        assertThat(target.apiKey()).isEqualTo("sk-openai-env");
        assertThat(target.model()).isNull();
    }

    @Test
    void whenPlatformModelAssigned_thenReturnsModelProviderKeyAndBaseUrl() {
        // Arrange
        PlatformAiModel model = mock(PlatformAiModel.class);
        when(model.getProvider()).thenReturn("nvidia");
        when(model.getModelId()).thenReturn("llama-3.3-70b");
        when(model.getApiKey()).thenReturn("nvapi-key");
        when(model.getBaseUrl()).thenReturn("https://integrate.api.nvidia.com/v1");
        when(platformAiConfigService.getActiveModelForFeature(AiFeature.ASSISTANT_CHAT.name()))
                .thenReturn(Optional.of(model));

        // Act
        AssistantTargetResolver.ChatTarget target = resolver.resolve(1L, null);

        // Assert
        assertThat(target.provider()).isEqualTo("nvidia");
        assertThat(target.model()).isEqualTo("llama-3.3-70b");
        assertThat(target.apiKey()).isEqualTo("nvapi-key");
        assertThat(target.baseUrl()).isEqualTo("https://integrate.api.nvidia.com/v1");
    }

    @Test
    void whenContextModelOverridePresent_thenItPrimesOverResolvedModel() {
        // Arrange
        when(keyRepo.findByOrganizationIdAndProvider(1L, "anthropic"))
                .thenReturn(Optional.of(validKey("sk-ant-byok", "claude-sonnet")));

        // Act
        AssistantTargetResolver.ChatTarget target = resolver.resolve(1L, "claude-haiku-brief");

        // Assert
        assertThat(target.model()).isEqualTo("claude-haiku-brief");
        assertThat(target.apiKey()).isEqualTo("sk-ant-byok");
    }

    @Test
    void whenLookupThrows_thenFailsSafeToAnthropicDefault() {
        // Arrange
        when(platformAiConfigService.getActiveProviderForFeature(anyString()))
                .thenThrow(new RuntimeException("db down"));
        when(platformAiConfigService.getActiveModelForFeature(anyString()))
                .thenThrow(new RuntimeException("db down"));
        when(keyRepo.findByOrganizationIdAndProvider(anyLong(), anyString()))
                .thenThrow(new RuntimeException("db down"));

        // Act
        AssistantTargetResolver.ChatTarget target = resolver.resolve(1L, null);

        // Assert
        assertThat(target.provider()).isEqualTo("anthropic");
        assertThat(target.apiKey()).isNull();
    }
}
