package com.clenzy.service;

import com.clenzy.config.AiProperties;
import com.clenzy.exception.AiNotConfiguredException;
import com.clenzy.model.AiFeature;
import com.clenzy.model.OrgAiApiKey;
import com.clenzy.model.PlatformAiFeatureModel;
import com.clenzy.model.PlatformAiModel;
import com.clenzy.repository.OrgAiApiKeyRepository;
import com.clenzy.repository.PlatformAiFeatureModelRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AiKeyResolverTest {

    private AiProperties aiProperties;
    private OrgAiApiKeyRepository orgAiApiKeyRepository;
    private PlatformAiFeatureModelRepository platformAiFeatureModelRepository;
    private AiKeyResolver resolver;

    private static final Long ORG_ID = 1L;
    private static final String PLATFORM_KEY = "sk-platform-key-123";
    private static final String ORG_KEY = "sk-org-key-456";

    @BeforeEach
    void setUp() {
        aiProperties = new AiProperties();
        AiProperties.Anthropic anthropic = new AiProperties.Anthropic();
        anthropic.setApiKey(PLATFORM_KEY);
        aiProperties.setAnthropic(anthropic);

        AiProperties.OpenAi openAi = new AiProperties.OpenAi();
        openAi.setApiKey(PLATFORM_KEY);
        aiProperties.setOpenai(openAi);

        orgAiApiKeyRepository = mock(OrgAiApiKeyRepository.class);
        platformAiFeatureModelRepository = mock(PlatformAiFeatureModelRepository.class);
        resolver = new AiKeyResolver(aiProperties, orgAiApiKeyRepository, platformAiFeatureModelRepository);
    }

    @Nested
    @DisplayName("resolve()")
    class Resolve {

        @Test
        @DisplayName("returns org key when org has valid key")
        void whenOrgHasValidKey_returnsOrgKey() {
            OrgAiApiKey orgKey = new OrgAiApiKey(ORG_ID, "anthropic", ORG_KEY);
            orgKey.setValid(true);
            when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(ORG_ID, "anthropic"))
                    .thenReturn(Optional.of(orgKey));

            AiKeyResolver.ResolvedKey result = resolver.resolve(ORG_ID, "anthropic");

            assertEquals(ORG_KEY, result.apiKey());
            assertEquals(AiKeyResolver.KeySource.ORGANIZATION, result.source());
            assertNull(result.modelOverride());
        }

        @Test
        @DisplayName("returns org key with model override")
        void whenOrgHasKeyWithModelOverride_returnsModelOverride() {
            OrgAiApiKey orgKey = new OrgAiApiKey(ORG_ID, "anthropic", ORG_KEY);
            orgKey.setValid(true);
            orgKey.setModelOverride("claude-haiku-4-20250514");
            when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(ORG_ID, "anthropic"))
                    .thenReturn(Optional.of(orgKey));

            AiKeyResolver.ResolvedKey result = resolver.resolve(ORG_ID, "anthropic");

            assertEquals(ORG_KEY, result.apiKey());
            assertEquals("claude-haiku-4-20250514", result.modelOverride());
            assertEquals(AiKeyResolver.KeySource.ORGANIZATION, result.source());
        }

        @Test
        @DisplayName("falls back to platform key when org key is invalid")
        void whenOrgHasInvalidKey_fallsBackToPlatformKey() {
            OrgAiApiKey orgKey = new OrgAiApiKey(ORG_ID, "anthropic", ORG_KEY);
            orgKey.setValid(false);
            when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(ORG_ID, "anthropic"))
                    .thenReturn(Optional.of(orgKey));

            AiKeyResolver.ResolvedKey result = resolver.resolve(ORG_ID, "anthropic");

            assertEquals(PLATFORM_KEY, result.apiKey());
            assertEquals(AiKeyResolver.KeySource.PLATFORM, result.source());
            assertNull(result.modelOverride());
        }

        @Test
        @DisplayName("returns platform key when no org key exists")
        void whenNoOrgKey_returnsPlatformKey() {
            when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(ORG_ID, "anthropic"))
                    .thenReturn(Optional.empty());

            AiKeyResolver.ResolvedKey result = resolver.resolve(ORG_ID, "anthropic");

            assertEquals(PLATFORM_KEY, result.apiKey());
            assertEquals(AiKeyResolver.KeySource.PLATFORM, result.source());
        }

        @Test
        @DisplayName("falls back to platform DB feature model when no org key and no env var")
        void whenNoPlatformEnvKey_fallsBackToPlatformFeatureModel() {
            aiProperties.getAnthropic().setApiKey("");
            PlatformAiModel model = new PlatformAiModel("Bedrock Nova", "bedrock",
                    "amazon.nova-lite-v1:0", "bedrock-key-123",
                    "https://bedrock-mantle.eu-west-1.api.aws/v1");
            model.setId(1L);
            PlatformAiFeatureModel featureModel = new PlatformAiFeatureModel("MESSAGING", model);
            when(platformAiFeatureModelRepository.findByFeature("MESSAGING"))
                    .thenReturn(Optional.of(featureModel));
            when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(ORG_ID, "anthropic"))
                    .thenReturn(Optional.empty());

            AiKeyResolver.ResolvedKey result = resolver.resolve(ORG_ID, "anthropic", AiFeature.MESSAGING);

            assertEquals("bedrock-key-123", result.apiKey());
            assertEquals("amazon.nova-lite-v1:0", result.modelOverride());
            assertEquals(AiKeyResolver.KeySource.PLATFORM_DB, result.source());
            assertEquals("bedrock", result.providerName());
            assertEquals("https://bedrock-mantle.eu-west-1.api.aws/v1", result.baseUrl());
        }

        @Test
        @DisplayName("falls back to env var when feature has no assigned model")
        void whenFeatureNotAssigned_fallsBackToEnvVar() {
            when(platformAiFeatureModelRepository.findByFeature("ANALYTICS"))
                    .thenReturn(Optional.empty());
            when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(ORG_ID, "anthropic"))
                    .thenReturn(Optional.empty());

            AiKeyResolver.ResolvedKey result = resolver.resolve(ORG_ID, "anthropic", AiFeature.ANALYTICS);

            assertEquals(PLATFORM_KEY, result.apiKey());
            assertEquals(AiKeyResolver.KeySource.PLATFORM, result.source());
        }

        @Test
        @DisplayName("throws AiNotConfiguredException when no key at all")
        void whenNeitherAvailable_throwsAiNotConfigured() {
            aiProperties.getAnthropic().setApiKey("");
            when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(ORG_ID, "anthropic"))
                    .thenReturn(Optional.empty());

            AiNotConfiguredException ex = assertThrows(
                    AiNotConfiguredException.class,
                    () -> resolver.resolve(ORG_ID, "anthropic")
            );

            assertEquals("AI_NOT_CONFIGURED", ex.getErrorCode());
            assertEquals("anthropic", ex.getFeature());
        }

        @Test
        @DisplayName("works with openai provider")
        void worksWithOpenAi() {
            when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(ORG_ID, "openai"))
                    .thenReturn(Optional.empty());

            AiKeyResolver.ResolvedKey result = resolver.resolve(ORG_ID, "openai");

            assertEquals(PLATFORM_KEY, result.apiKey());
            assertEquals(AiKeyResolver.KeySource.PLATFORM, result.source());
        }

        @Test
        @DisplayName("throws AiNotConfiguredException for unknown provider (no key found)")
        void throwsForUnknownProvider() {
            when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(ORG_ID, "unknown"))
                    .thenReturn(Optional.empty());

            AiNotConfiguredException ex = assertThrows(AiNotConfiguredException.class,
                    () -> resolver.resolve(ORG_ID, "unknown"));
            assertEquals("AI_NOT_CONFIGURED", ex.getErrorCode());
        }

        @Test
        @DisplayName("falls back to platform when orgId is null")
        void whenOrgIdNull_fallsBackToPlatformKey() {
            AiKeyResolver.ResolvedKey result = resolver.resolve(null, "anthropic");

            assertEquals(PLATFORM_KEY, result.apiKey());
            assertEquals(AiKeyResolver.KeySource.PLATFORM, result.source());
            verifyNoInteractions(orgAiApiKeyRepository);
        }
    }

}
