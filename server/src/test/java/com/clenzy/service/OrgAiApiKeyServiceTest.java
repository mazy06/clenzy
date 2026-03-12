package com.clenzy.service;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.AiProviderException;
import com.clenzy.config.ai.AiRequest;
import com.clenzy.config.ai.AiResponse;
import com.clenzy.config.ai.AnthropicProvider;
import com.clenzy.config.ai.OpenAiProvider;
import com.clenzy.dto.AiApiKeyTestResultDto;
import com.clenzy.dto.OrgAiApiKeyStatusDto;
import com.clenzy.model.OrgAiApiKey;
import com.clenzy.repository.OrgAiApiKeyRepository;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrgAiApiKeyServiceTest {

    @Mock private OrgAiApiKeyRepository repository;
    @Mock private AiProperties aiProperties;
    @Mock private OpenAiProvider openAiProvider;
    @Mock private AnthropicProvider anthropicProvider;
    @InjectMocks private OrgAiApiKeyService service;

    private static final Long ORG_ID = 1L;

    private OrgAiApiKey createOrgKey(String provider, String apiKey, boolean valid) {
        OrgAiApiKey key = new OrgAiApiKey(ORG_ID, provider, apiKey);
        key.setValid(valid);
        return key;
    }

    // ─── getStatus ──────────────────────────────────────────────────────

    @Nested
    class GetStatus {

        @Test
        void noOrgKeys_returnsPlatformStatus() {
            when(repository.findByOrganizationId(ORG_ID)).thenReturn(List.of());
            AiProperties.OpenAi openai = new AiProperties.OpenAi();
            openai.setApiKey("sk-platform-openai");
            AiProperties.Anthropic anthropic = new AiProperties.Anthropic();
            anthropic.setApiKey("sk-platform-anthropic");
            when(aiProperties.getOpenai()).thenReturn(openai);
            when(aiProperties.getAnthropic()).thenReturn(anthropic);

            List<OrgAiApiKeyStatusDto> statuses = service.getStatus(ORG_ID);

            assertEquals(2, statuses.size());
            OrgAiApiKeyStatusDto openaiStatus = statuses.stream()
                    .filter(s -> "openai".equals(s.provider())).findFirst().orElseThrow();
            assertFalse(openaiStatus.configured());
            assertNull(openaiStatus.maskedApiKey());
            assertEquals("PLATFORM", openaiStatus.source());
        }

        @Test
        void withOrgKey_returnsOrganizationStatus() {
            OrgAiApiKey orgKey = createOrgKey("anthropic", "sk-ant-my-secret-key", true);
            when(repository.findByOrganizationId(ORG_ID)).thenReturn(List.of(orgKey));
            AiProperties.OpenAi openai = new AiProperties.OpenAi();
            openai.setApiKey("sk-platform");
            when(aiProperties.getOpenai()).thenReturn(openai);

            List<OrgAiApiKeyStatusDto> statuses = service.getStatus(ORG_ID);

            OrgAiApiKeyStatusDto anthropicStatus = statuses.stream()
                    .filter(s -> "anthropic".equals(s.provider())).findFirst().orElseThrow();
            assertTrue(anthropicStatus.configured());
            assertEquals("ORGANIZATION", anthropicStatus.source());
            assertTrue(anthropicStatus.valid());
            assertNotNull(anthropicStatus.maskedApiKey());
            // Should be masked — NOT return the real key
            assertFalse(anthropicStatus.maskedApiKey().contains("my-secret-key"));
        }

        @Test
        void returnsMaskedKey() {
            OrgAiApiKey orgKey = createOrgKey("openai", "sk-test-1234abcd", true);
            when(repository.findByOrganizationId(ORG_ID)).thenReturn(List.of(orgKey));
            AiProperties.Anthropic anthropic = new AiProperties.Anthropic();
            anthropic.setApiKey("sk-platform");
            when(aiProperties.getAnthropic()).thenReturn(anthropic);

            List<OrgAiApiKeyStatusDto> statuses = service.getStatus(ORG_ID);

            OrgAiApiKeyStatusDto openaiStatus = statuses.stream()
                    .filter(s -> "openai".equals(s.provider())).findFirst().orElseThrow();
            assertTrue(openaiStatus.maskedApiKey().endsWith("abcd"));
            assertTrue(openaiStatus.maskedApiKey().startsWith("*"));
        }
    }

    // ─── testKey ────────────────────────────────────────────────────────

    @Nested
    class TestKey {

        @Test
        void openai_validKey_returnsSuccess() {
            when(openAiProvider.chat(any(AiRequest.class), eq("sk-valid-key")))
                    .thenReturn(new AiResponse("OK", 5, 2, 7, "gpt-4o", "stop"));

            AiApiKeyTestResultDto result = service.testKey("openai", "sk-valid-key");

            assertTrue(result.success());
            assertEquals("openai", result.provider());
        }

        @Test
        void anthropic_validKey_returnsSuccess() {
            when(anthropicProvider.chat(any(AiRequest.class), eq("sk-ant-valid")))
                    .thenReturn(new AiResponse("OK", 5, 2, 7, "claude-3-haiku", "end_turn"));

            AiApiKeyTestResultDto result = service.testKey("anthropic", "sk-ant-valid");

            assertTrue(result.success());
            assertEquals("anthropic", result.provider());
        }

        @Test
        void anthropic_invalidKey_returnsFailure() {
            when(anthropicProvider.chat(any(AiRequest.class), eq("sk-ant-bad")))
                    .thenThrow(new AiProviderException("anthropic", "401 Unauthorized"));

            AiApiKeyTestResultDto result = service.testKey("anthropic", "sk-ant-bad");

            assertFalse(result.success());
            assertEquals("anthropic", result.provider());
        }

        @Test
        void invalidProvider_throws() {
            assertThrows(IllegalArgumentException.class,
                    () -> service.testKey("gemini", "sk-test"));
        }
    }

    // ─── saveKey ────────────────────────────────────────────────────────

    @Nested
    class SaveKey {

        @Test
        void newKey_persistsAndReturnsStatus() {
            when(repository.findByOrganizationIdAndProvider(ORG_ID, "openai"))
                    .thenReturn(Optional.empty());
            when(openAiProvider.chat(any(AiRequest.class), eq("sk-new-key")))
                    .thenReturn(new AiResponse("OK", 5, 2, 7, "gpt-4o", "stop"));
            when(repository.save(any(OrgAiApiKey.class))).thenAnswer(inv -> inv.getArgument(0));

            OrgAiApiKeyStatusDto result = service.saveKey(ORG_ID, "openai", "sk-new-key", null);

            assertTrue(result.configured());
            assertTrue(result.valid());
            assertEquals("ORGANIZATION", result.source());
            assertEquals("openai", result.provider());
            verify(repository).save(any(OrgAiApiKey.class));
        }

        @Test
        void existingKey_updatesAndReturnsStatus() {
            OrgAiApiKey existing = createOrgKey("anthropic", "sk-old-key", true);
            when(repository.findByOrganizationIdAndProvider(ORG_ID, "anthropic"))
                    .thenReturn(Optional.of(existing));
            when(anthropicProvider.chat(any(AiRequest.class), eq("sk-new-anthropic")))
                    .thenReturn(new AiResponse("OK", 5, 2, 7, "claude-3-haiku", "end_turn"));
            when(repository.save(any(OrgAiApiKey.class))).thenAnswer(inv -> inv.getArgument(0));

            OrgAiApiKeyStatusDto result = service.saveKey(ORG_ID, "anthropic", "sk-new-anthropic", "claude-sonnet-4-20250514");

            assertTrue(result.configured());
            assertTrue(result.valid());
            assertEquals("claude-sonnet-4-20250514", result.modelOverride());
            verify(repository).save(any(OrgAiApiKey.class));
        }

        @Test
        void invalidKey_throwsAndDoesNotPersist() {
            when(openAiProvider.chat(any(AiRequest.class), eq("sk-bad-key")))
                    .thenThrow(new AiProviderException("openai", "401 Unauthorized"));

            IllegalArgumentException ex = assertThrows(
                    IllegalArgumentException.class,
                    () -> service.saveKey(ORG_ID, "openai", "sk-bad-key", null)
            );

            assertTrue(ex.getMessage().contains("invalide"));
            verify(repository, never()).save(any(OrgAiApiKey.class));
        }
    }

    // ─── deleteKey ──────────────────────────────────────────────────────

    @Nested
    class DeleteKey {

        @Test
        void deletesEntry() {
            service.deleteKey(ORG_ID, "openai");
            verify(repository).deleteByOrganizationIdAndProvider(ORG_ID, "openai");
        }

        @Test
        void invalidProvider_throws() {
            assertThrows(IllegalArgumentException.class,
                    () -> service.deleteKey(ORG_ID, "gemini"));
        }
    }
}
