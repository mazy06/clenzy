package com.clenzy.service;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.AiProviderException;
import com.clenzy.config.ai.AiRequest;
import com.clenzy.config.ai.AiResponse;
import com.clenzy.config.ai.AnthropicProvider;
import com.clenzy.dto.PlatformAiModelDto;
import com.clenzy.dto.SavePlatformModelRequest;
import com.clenzy.dto.TestPlatformModelRequest;
import com.clenzy.model.AiFeature;
import com.clenzy.model.AiTokenBudget;
import com.clenzy.model.PlatformAiFeatureModel;
import com.clenzy.model.PlatformAiModel;
import com.clenzy.repository.AiTokenBudgetRepository;
import com.clenzy.repository.PlatformAiFeatureModelRepository;
import com.clenzy.repository.PlatformAiModelRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PlatformAiConfigServiceTest {

    @Mock private PlatformAiModelRepository modelRepository;
    @Mock private PlatformAiFeatureModelRepository featureModelRepository;
    @Mock private AiTokenBudgetRepository budgetRepository;
    @Mock private AnthropicProvider anthropicProvider;

    private AiProperties aiProperties;
    private PlatformAiConfigService service;

    @BeforeEach
    void setUp() {
        aiProperties = new AiProperties();
        aiProperties.getTokenBudget().setDefaultMonthlyTokens(100_000L);
        service = new PlatformAiConfigService(
                modelRepository, featureModelRepository, budgetRepository,
                aiProperties, anthropicProvider);
    }

    private PlatformAiModel buildModel(Long id, String name, String provider, String modelId, String apiKey) {
        PlatformAiModel m = new PlatformAiModel(name, provider, modelId, apiKey, "https://api.example.com/v1");
        m.setId(id);
        return m;
    }

    // ─── getModels ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getModels")
    class GetModels {

        @Test
        void emptyRepo_returnsEmptyList() {
            when(modelRepository.findAll()).thenReturn(List.of());
            when(featureModelRepository.findAll()).thenReturn(List.of());

            List<PlatformAiModelDto> result = service.getModels();

            assertThat(result).isEmpty();
        }

        @Test
        void modelsWithAssignedFeatures_returnsDtosWithFeatureLists() {
            PlatformAiModel m1 = buildModel(1L, "Claude Sonnet", "anthropic", "claude-sonnet-4-20250514", "sk-ant-xxxx");
            PlatformAiModel m2 = buildModel(2L, "GPT-4o", "openai", "gpt-4o", "sk-openai-yyyy");
            when(modelRepository.findAll()).thenReturn(List.of(m1, m2));

            PlatformAiFeatureModel fm1 = new PlatformAiFeatureModel("DESIGN", m1);
            PlatformAiFeatureModel fm2 = new PlatformAiFeatureModel("PRICING", m1);
            PlatformAiFeatureModel fm3 = new PlatformAiFeatureModel("MESSAGING", m2);
            when(featureModelRepository.findAll()).thenReturn(List.of(fm1, fm2, fm3));

            List<PlatformAiModelDto> result = service.getModels();

            assertThat(result).hasSize(2);
            PlatformAiModelDto first = result.stream().filter(d -> d.id().equals(1L)).findFirst().orElseThrow();
            assertThat(first.assignedFeatures()).containsExactlyInAnyOrder("DESIGN", "PRICING");
            assertThat(first.maskedApiKey()).endsWith("xxxx");
        }
    }

    // ─── getActiveModelForFeature ──────────────────────────────────────────

    @Nested
    @DisplayName("getActiveModelForFeature")
    class GetActiveModelForFeature {

        @Test
        void found_returnsModel() {
            PlatformAiModel m = buildModel(1L, "n", "anthropic", "m", "k");
            PlatformAiFeatureModel fm = new PlatformAiFeatureModel("DESIGN", m);
            when(featureModelRepository.findByFeature("DESIGN")).thenReturn(Optional.of(fm));

            Optional<PlatformAiModel> result = service.getActiveModelForFeature("DESIGN");

            assertThat(result).isPresent();
            assertThat(result.get().getId()).isEqualTo(1L);
        }

        @Test
        void notFound_returnsEmpty() {
            when(featureModelRepository.findByFeature("UNKNOWN")).thenReturn(Optional.empty());

            Optional<PlatformAiModel> result = service.getActiveModelForFeature("UNKNOWN");

            assertThat(result).isEmpty();
        }
    }

    // ─── testModel ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("testModel")
    class TestModel {

        @Test
        void unsupportedProvider_throws() {
            TestPlatformModelRequest req = new TestPlatformModelRequest(
                    "unknown-provider", "model-x", "sk-key", null);

            assertThatThrownBy(() -> service.testModel(req))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Unsupported provider");
        }

        @Test
        void anthropicProvider_success_returnsTrue() {
            when(anthropicProvider.chat(any(AiRequest.class), eq("sk-ant-xxx")))
                    .thenReturn(new AiResponse("OK", 1, 1, 2, "claude-sonnet-4-20250514", "stop"));

            TestPlatformModelRequest req = new TestPlatformModelRequest(
                    "anthropic", "claude-sonnet-4-20250514", "sk-ant-xxx", null);

            assertThat(service.testModel(req)).isTrue();
        }

        @Test
        void anthropicProvider_emptyContent_returnsFalse() {
            when(anthropicProvider.chat(any(AiRequest.class), anyString()))
                    .thenReturn(new AiResponse("", 0, 0, 0, "x", "stop"));

            TestPlatformModelRequest req = new TestPlatformModelRequest(
                    "anthropic", "claude-sonnet-4-20250514", "sk-x", null);

            assertThat(service.testModel(req)).isFalse();
        }

        @Test
        void anthropicProvider_nullContent_returnsFalse() {
            when(anthropicProvider.chat(any(AiRequest.class), anyString()))
                    .thenReturn(new AiResponse(null, 0, 0, 0, "x", "stop"));

            TestPlatformModelRequest req = new TestPlatformModelRequest(
                    "anthropic", "model", "sk-key", null);

            assertThat(service.testModel(req)).isFalse();
        }

        @Test
        void anthropicProvider_throws_returnsFalse() {
            when(anthropicProvider.chat(any(AiRequest.class), anyString()))
                    .thenThrow(new AiProviderException("anthropic", "down"));

            TestPlatformModelRequest req = new TestPlatformModelRequest(
                    "anthropic", "model", "sk-key", null);

            assertThat(service.testModel(req)).isFalse();
        }

        @Test
        void openaiProvider_invalidUrl_returnsFalse() {
            // The OpenAI path uses a real RestClient — we cannot easily mock here
            // without modifying the source. An invalid URL will throw and be caught.
            TestPlatformModelRequest req = new TestPlatformModelRequest(
                    "openai", "gpt-4o", "sk-fake", "https://invalid.example.fake-domain-xyz");

            // This should NOT throw — caught by service and return false.
            boolean result = service.testModel(req);
            assertThat(result).isFalse();
        }

        @Test
        void httpBaseUrl_validatedRejects() {
            TestPlatformModelRequest req = new TestPlatformModelRequest(
                    "openai", "gpt-4o", "sk", "http://insecure.com");

            assertThatThrownBy(() -> service.testModel(req))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("HTTPS");
        }

        @Test
        void blankBaseUrl_usesDefault() {
            when(anthropicProvider.chat(any(AiRequest.class), anyString()))
                    .thenReturn(new AiResponse("OK", 1, 1, 2, "m", "stop"));

            TestPlatformModelRequest req = new TestPlatformModelRequest(
                    "anthropic", "model", "sk", "");

            assertThat(service.testModel(req)).isTrue();
        }
    }

    // ─── saveModel ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("saveModel")
    class SaveModel {

        @Test
        void newModel_savesAndReturnsDto() {
            when(modelRepository.save(any(PlatformAiModel.class))).thenAnswer(inv -> {
                PlatformAiModel m = inv.getArgument(0);
                m.setId(10L);
                return m;
            });
            when(featureModelRepository.findAll()).thenReturn(List.of());

            SavePlatformModelRequest req = new SavePlatformModelRequest(
                    null, "Claude", "anthropic", "claude-sonnet-4-20250514", "sk-ant-abcd", null);

            PlatformAiModelDto result = service.saveModel(req, "admin@example.com");

            assertThat(result.id()).isEqualTo(10L);
            assertThat(result.name()).isEqualTo("Claude");
            assertThat(result.provider()).isEqualTo("anthropic");
            assertThat(result.modelId()).isEqualTo("claude-sonnet-4-20250514");
            // baseUrl should resolve to anthropic default
            assertThat(result.baseUrl()).isEqualTo("https://api.anthropic.com/v1");
        }

        @Test
        void existingModel_updatesAndPreservesId() {
            PlatformAiModel existing = buildModel(5L, "OldName", "openai", "gpt-3", "old-key");
            when(modelRepository.findById(5L)).thenReturn(Optional.of(existing));
            when(modelRepository.save(any(PlatformAiModel.class))).thenAnswer(inv -> inv.getArgument(0));
            when(featureModelRepository.findAll()).thenReturn(List.of());

            SavePlatformModelRequest req = new SavePlatformModelRequest(
                    5L, "NewName", "openai", "gpt-4o", "sk-new-1234", "https://api.openai.com/v1");

            PlatformAiModelDto result = service.saveModel(req, "admin");

            assertThat(result.name()).isEqualTo("NewName");
            assertThat(result.modelId()).isEqualTo("gpt-4o");
            assertThat(existing.getApiKey()).isEqualTo("sk-new-1234");
            assertThat(existing.getUpdatedBy()).isEqualTo("admin");
            assertThat(existing.getLastValidatedAt()).isNotNull();
        }

        @Test
        void notFoundExistingModel_throws() {
            when(modelRepository.findById(99L)).thenReturn(Optional.empty());

            SavePlatformModelRequest req = new SavePlatformModelRequest(
                    99L, "x", "anthropic", "m", "k", null);

            assertThatThrownBy(() -> service.saveModel(req, "admin"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("not found");
        }

        @Test
        void invalidProvider_throws() {
            SavePlatformModelRequest req = new SavePlatformModelRequest(
                    null, "x", "unknown", "m", "k", null);

            assertThatThrownBy(() -> service.saveModel(req, "admin"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Unsupported");
        }

        @Test
        void httpBaseUrl_throws() {
            SavePlatformModelRequest req = new SavePlatformModelRequest(
                    null, "x", "anthropic", "m", "k", "http://insecure");

            assertThatThrownBy(() -> service.saveModel(req, "admin"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("HTTPS");
        }

        @Test
        void savedModel_includesAssignedFeatures() {
            PlatformAiModel saved = buildModel(10L, "n", "anthropic", "m", "k");
            when(modelRepository.save(any(PlatformAiModel.class))).thenReturn(saved);

            PlatformAiFeatureModel fm = new PlatformAiFeatureModel("DESIGN", saved);
            when(featureModelRepository.findAll()).thenReturn(List.of(fm));

            SavePlatformModelRequest req = new SavePlatformModelRequest(
                    null, "n", "anthropic", "m", "k", null);

            PlatformAiModelDto result = service.saveModel(req, "admin");

            assertThat(result.assignedFeatures()).contains("DESIGN");
        }
    }

    // ─── deleteModel ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("deleteModel")
    class DeleteModel {

        @Test
        void existing_deletes() {
            when(modelRepository.existsById(10L)).thenReturn(true);

            service.deleteModel(10L);

            verify(modelRepository).deleteById(10L);
        }

        @Test
        void notExisting_throws() {
            when(modelRepository.existsById(99L)).thenReturn(false);

            assertThatThrownBy(() -> service.deleteModel(99L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("not found");
        }
    }

    // ─── assignModelToFeature ──────────────────────────────────────────────

    @Nested
    @DisplayName("assignModelToFeature")
    class AssignModelToFeature {

        @Test
        void noPriorAssignment_createsNew() {
            PlatformAiModel m = buildModel(1L, "n", "anthropic", "m", "k");
            when(modelRepository.findById(1L)).thenReturn(Optional.of(m));
            when(featureModelRepository.findByFeature("DESIGN")).thenReturn(Optional.empty());

            service.assignModelToFeature(1L, "DESIGN");

            ArgumentCaptor<PlatformAiFeatureModel> captor =
                    ArgumentCaptor.forClass(PlatformAiFeatureModel.class);
            verify(featureModelRepository).save(captor.capture());
            assertThat(captor.getValue().getFeature()).isEqualTo("DESIGN");
            assertThat(captor.getValue().getModel().getId()).isEqualTo(1L);
        }

        @Test
        void existingAssignment_updatesModel() {
            PlatformAiModel oldM = buildModel(1L, "old", "openai", "gpt-3", "k1");
            PlatformAiModel newM = buildModel(2L, "new", "anthropic", "m", "k2");
            when(modelRepository.findById(2L)).thenReturn(Optional.of(newM));

            PlatformAiFeatureModel existing = new PlatformAiFeatureModel("PRICING", oldM);
            when(featureModelRepository.findByFeature("PRICING")).thenReturn(Optional.of(existing));

            service.assignModelToFeature(2L, "PRICING");

            assertThat(existing.getModel().getId()).isEqualTo(2L);
            verify(featureModelRepository).save(existing);
        }

        @Test
        void modelNotFound_throws() {
            when(modelRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.assignModelToFeature(99L, "DESIGN"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("not found");
        }
    }

    // ─── unassignFeature ───────────────────────────────────────────────────

    @Nested
    @DisplayName("unassignFeature")
    class UnassignFeature {

        @Test
        void delegatesToRepository() {
            service.unassignFeature("DESIGN");

            verify(featureModelRepository).deleteByFeature("DESIGN");
        }
    }

    // ─── getFeatureAssignments ─────────────────────────────────────────────

    @Nested
    @DisplayName("getFeatureAssignments")
    class GetFeatureAssignments {

        @Test
        void noAssignments_returnsEmptyMap() {
            when(featureModelRepository.findAll()).thenReturn(List.of());

            Map<String, PlatformAiModelDto> result = service.getFeatureAssignments();

            assertThat(result).isEmpty();
        }

        @Test
        void multipleAssignments_returnsKeyedMap() {
            PlatformAiModel m1 = buildModel(1L, "Claude", "anthropic", "claude", "k1");
            PlatformAiModel m2 = buildModel(2L, "GPT", "openai", "gpt-4o", "k2");

            PlatformAiFeatureModel fm1 = new PlatformAiFeatureModel("DESIGN", m1);
            PlatformAiFeatureModel fm2 = new PlatformAiFeatureModel("PRICING", m2);
            when(featureModelRepository.findAll()).thenReturn(List.of(fm1, fm2));

            Map<String, PlatformAiModelDto> result = service.getFeatureAssignments();

            assertThat(result).hasSize(2);
            assertThat(result.get("DESIGN").id()).isEqualTo(1L);
            assertThat(result.get("PRICING").id()).isEqualTo(2L);
        }
    }

    // ─── getFeatureBudgets ─────────────────────────────────────────────────

    @Nested
    @DisplayName("getFeatureBudgets")
    class GetFeatureBudgets {

        @Test
        void allDefault_whenNoRowsInDb() {
            when(budgetRepository.findByOrganizationIdAndFeature(eq(null), any(AiFeature.class)))
                    .thenReturn(Optional.empty());

            Map<String, Long> result = service.getFeatureBudgets();

            for (AiFeature f : AiFeature.values()) {
                assertThat(result.get(f.name())).isEqualTo(100_000L);
            }
        }

        @Test
        void customBudgetOnOneFeature_overridesDefault() {
            when(budgetRepository.findByOrganizationIdAndFeature(eq(null), any(AiFeature.class)))
                    .thenAnswer(inv -> {
                        AiFeature feature = inv.getArgument(1);
                        if (feature == AiFeature.DESIGN) {
                            AiTokenBudget b = new AiTokenBudget(null, AiFeature.DESIGN, 500_000L);
                            return Optional.of(b);
                        }
                        return Optional.empty();
                    });

            Map<String, Long> result = service.getFeatureBudgets();

            assertThat(result.get("DESIGN")).isEqualTo(500_000L);
            assertThat(result.get("PRICING")).isEqualTo(100_000L);
        }
    }

    // ─── setFeatureBudget ──────────────────────────────────────────────────

    @Nested
    @DisplayName("setFeatureBudget")
    class SetFeatureBudget {

        @Test
        void existing_updatesLimit() {
            AiTokenBudget existing = new AiTokenBudget(null, AiFeature.DESIGN, 50_000L);
            when(budgetRepository.findByOrganizationIdAndFeature(null, AiFeature.DESIGN))
                    .thenReturn(Optional.of(existing));

            service.setFeatureBudget("DESIGN", 200_000L);

            assertThat(existing.getMonthlyTokenLimit()).isEqualTo(200_000L);
            verify(budgetRepository).save(existing);
        }

        @Test
        void notExisting_createsNew() {
            when(budgetRepository.findByOrganizationIdAndFeature(null, AiFeature.PRICING))
                    .thenReturn(Optional.empty());

            service.setFeatureBudget("PRICING", 300_000L);

            ArgumentCaptor<AiTokenBudget> captor = ArgumentCaptor.forClass(AiTokenBudget.class);
            verify(budgetRepository).save(captor.capture());
            assertThat(captor.getValue().getFeature()).isEqualTo(AiFeature.PRICING);
            assertThat(captor.getValue().getMonthlyTokenLimit()).isEqualTo(300_000L);
        }

        @Test
        void invalidFeatureName_throws() {
            assertThatThrownBy(() -> service.setFeatureBudget("NOT_A_FEATURE", 1000L))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ─── SUPPORTED_PROVIDERS sanity ────────────────────────────────────────

    @Nested
    @DisplayName("SUPPORTED_PROVIDERS")
    class SupportedProviders {

        @Test
        void containsAllExpectedProviders() {
            assertThat(PlatformAiConfigService.SUPPORTED_PROVIDERS.keySet())
                    .containsExactlyInAnyOrder("bedrock", "nvidia", "openai", "anthropic");
        }

        @Test
        void anthropicDefaults_correct() {
            PlatformAiConfigService.ProviderDefaults d =
                    PlatformAiConfigService.SUPPORTED_PROVIDERS.get("anthropic");
            assertThat(d.model()).isEqualTo("claude-sonnet-4-20250514");
            assertThat(d.baseUrl()).isEqualTo("https://api.anthropic.com/v1");
        }

        @Test
        void openaiDefaults_correct() {
            PlatformAiConfigService.ProviderDefaults d =
                    PlatformAiConfigService.SUPPORTED_PROVIDERS.get("openai");
            assertThat(d.model()).isEqualTo("gpt-4o");
            assertThat(d.baseUrl()).isEqualTo("https://api.openai.com/v1");
        }
    }
}
