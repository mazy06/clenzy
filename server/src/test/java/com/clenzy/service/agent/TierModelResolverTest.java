package com.clenzy.service.agent;

import com.clenzy.model.AiModelAvailability;
import com.clenzy.model.PlatformAiFeatureModel;
import com.clenzy.model.PlatformAiModel;
import com.clenzy.repository.PlatformAiFeatureModelRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Tests de la resolution tier → modele (T-03, ADR-004 — pilotee par la config
 * dynamique en base depuis 2026-07-02). Invariant central : fallback strict =
 * modele du contexte des que la feature tier n'est pas assignee, que le
 * provider differe ou que le modele tier est indisponible.
 */
@ExtendWith(MockitoExtension.class)
class TierModelResolverTest {

    @Mock private PlatformAiFeatureModelRepository featureModelRepository;

    private TierModelResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new TierModelResolver(featureModelRepository);
    }

    private void assign(String feature, String provider, String modelId, AiModelAvailability status) {
        PlatformAiModel model = new PlatformAiModel();
        model.setProvider(provider);
        model.setModelId(modelId);
        model.setAvailabilityStatus(status);
        PlatformAiFeatureModel assignment = new PlatformAiFeatureModel();
        assignment.setFeature(feature);
        assignment.setModel(model);
        when(featureModelRepository.findByFeature(feature)).thenReturn(Optional.of(assignment));
    }

    @Test
    @DisplayName("tier null ou STANDARD -> modele du contexte, sans lookup")
    void standardOrNullTier_returnsContextModel() {
        assertThat(resolver.resolveModel(null, "anthropic", "claude-sonnet-4"))
                .isEqualTo("claude-sonnet-4");
        assertThat(resolver.resolveModel(AgentTier.STANDARD, "anthropic", "claude-sonnet-4"))
                .isEqualTo("claude-sonnet-4");
    }

    @Test
    @DisplayName("feature tier non assignee en base -> modele du contexte (tiering inactif)")
    void whenNoAssignment_thenContextModel() {
        when(featureModelRepository.findByFeature("ASSISTANT_SMALL")).thenReturn(Optional.empty());

        assertThat(resolver.resolveModel(AgentTier.SMALL, "anthropic", "claude-sonnet-4"))
                .isEqualTo("claude-sonnet-4");
    }

    @Test
    @DisplayName("SMALL assigne (meme provider) -> modele tier ; STRONG -> feature ASSISTANT_STRONG")
    void whenAssignedSameProvider_thenTierModel() {
        assign("ASSISTANT_SMALL", "anthropic", "claude-haiku-4-5", AiModelAvailability.AVAILABLE);
        assign("ASSISTANT_STRONG", "anthropic", "claude-opus-4-1", AiModelAvailability.AVAILABLE);

        assertThat(resolver.resolveModel(AgentTier.SMALL, "anthropic", "claude-sonnet-4"))
                .isEqualTo("claude-haiku-4-5");
        assertThat(resolver.resolveModel(AgentTier.STRONG, "anthropic", "claude-sonnet-4"))
                .isEqualTo("claude-opus-4-1");
    }

    @Test
    @DisplayName("garde meme-provider : contexte NVIDIA + tier anthropic -> modele du contexte")
    void whenProviderMismatch_thenContextModel() {
        assign("ASSISTANT_SMALL", "anthropic", "claude-haiku-4-5", AiModelAvailability.AVAILABLE);

        assertThat(resolver.resolveModel(AgentTier.SMALL, "nvidia", "meta/llama-3.1-8b-instruct"))
                .isEqualTo("meta/llama-3.1-8b-instruct");
    }

    @Test
    @DisplayName("provider null -> traite comme anthropic (defaut historique)")
    void whenProviderNull_thenDefaultsToAnthropic() {
        assign("ASSISTANT_SMALL", "anthropic", "claude-haiku-4-5", AiModelAvailability.AVAILABLE);

        assertThat(resolver.resolveModel(AgentTier.SMALL, null, "claude-sonnet-4"))
                .isEqualTo("claude-haiku-4-5");
    }

    @Test
    @DisplayName("modele tier UNAVAILABLE (probe dispo) -> modele du contexte")
    void whenTierModelUnavailable_thenContextModel() {
        assign("ASSISTANT_SMALL", "anthropic", "claude-haiku-4-5", AiModelAvailability.UNAVAILABLE);

        assertThat(resolver.resolveModel(AgentTier.SMALL, "anthropic", "claude-sonnet-4"))
                .isEqualTo("claude-sonnet-4");
    }

    @Test
    @DisplayName("casse du provider ignoree (Anthropic == ANTHROPIC)")
    void providerComparisonIsCaseInsensitive() {
        assign("ASSISTANT_SMALL", "Anthropic", "claude-haiku-4-5", AiModelAvailability.AVAILABLE);

        assertThat(resolver.resolveModel(AgentTier.SMALL, "ANTHROPIC", "claude-sonnet-4"))
                .isEqualTo("claude-haiku-4-5");
    }
}
