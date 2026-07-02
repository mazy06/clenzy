package com.clenzy.service.agent;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests de la resolution tier → modele (T-03, ADR-004). Invariant central :
 * fallback strict = modele du contexte (comportement historique) des que le
 * tiering est desactive, le tier STANDARD, le provider inconnu ou le mapping absent.
 */
class TierModelResolverTest {

    private TierModelResolver resolver(boolean enabled) {
        TierModelResolver r = new TierModelResolver();
        r.setEnabled(enabled);
        r.setSmall(Map.of("anthropic", "claude-haiku-4-5", "openai", "gpt-5-mini"));
        r.setStrong(Map.of("anthropic", "claude-opus-4-1"));
        return r;
    }

    @Test
    void disabled_alwaysReturnsContextModel() {
        assertThat(resolver(false).resolveModel(AgentTier.SMALL, "anthropic", "claude-sonnet-4"))
                .isEqualTo("claude-sonnet-4");
        assertThat(resolver(false).resolveModel(AgentTier.STRONG, "anthropic", "claude-sonnet-4"))
                .isEqualTo("claude-sonnet-4");
    }

    @Test
    void standardTier_returnsContextModel_evenWhenEnabled() {
        assertThat(resolver(true).resolveModel(AgentTier.STANDARD, "anthropic", "claude-sonnet-4"))
                .isEqualTo("claude-sonnet-4");
    }

    @Test
    void nullTier_returnsContextModel() {
        assertThat(resolver(true).resolveModel(null, "anthropic", "claude-sonnet-4"))
                .isEqualTo("claude-sonnet-4");
    }

    @Test
    void smallTier_resolvesPerProvider() {
        assertThat(resolver(true).resolveModel(AgentTier.SMALL, "anthropic", "claude-sonnet-4"))
                .isEqualTo("claude-haiku-4-5");
        assertThat(resolver(true).resolveModel(AgentTier.SMALL, "openai", "gpt-5"))
                .isEqualTo("gpt-5-mini");
    }

    @Test
    void strongTier_resolvesPerProvider() {
        assertThat(resolver(true).resolveModel(AgentTier.STRONG, "anthropic", "claude-sonnet-4"))
                .isEqualTo("claude-opus-4-1");
    }

    @Test
    void providerCaseInsensitive() {
        assertThat(resolver(true).resolveModel(AgentTier.SMALL, "Anthropic", "claude-sonnet-4"))
                .isEqualTo("claude-haiku-4-5");
    }

    @Test
    void unknownProvider_fallsBackToContextModel() {
        // Provider sans mapping (ex. org BYOK NVIDIA) : jamais d'id de modele invalide.
        assertThat(resolver(true).resolveModel(AgentTier.SMALL, "nvidia", "meta/llama-3"))
                .isEqualTo("meta/llama-3");
        assertThat(resolver(true).resolveModel(AgentTier.STRONG, "openai", "gpt-5"))
                .isEqualTo("gpt-5");
    }

    @Test
    void nullProvider_defaultsToAnthropicMapping() {
        assertThat(resolver(true).resolveModel(AgentTier.SMALL, null, "claude-sonnet-4"))
                .isEqualTo("claude-haiku-4-5");
    }
}
