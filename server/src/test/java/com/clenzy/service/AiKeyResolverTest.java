package com.clenzy.service;

import com.clenzy.config.AiProperties;
import com.clenzy.exception.AiNotConfiguredException;
import com.clenzy.model.OrgAiApiKey;
import com.clenzy.repository.OrgAiApiKeyRepository;
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
        resolver = new AiKeyResolver(aiProperties, orgAiApiKeyRepository);
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
        @DisplayName("throws AiNotConfiguredException when neither key available")
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
        @DisplayName("throws for unknown provider")
        void throwsForUnknownProvider() {
            assertThrows(IllegalArgumentException.class,
                    () -> resolver.resolve(ORG_ID, "unknown"));
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
