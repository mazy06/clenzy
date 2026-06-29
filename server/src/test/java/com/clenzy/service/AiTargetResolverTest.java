package com.clenzy.service;

import com.clenzy.config.AiProperties;
import com.clenzy.exception.AiNotConfiguredException;
import com.clenzy.model.AiFeature;
import com.clenzy.model.AiModelAvailability;
import com.clenzy.model.OrgAiApiKey;
import com.clenzy.model.PlatformAiFeatureModel;
import com.clenzy.model.PlatformAiFeatureProvider;
import com.clenzy.model.PlatformAiModel;
import com.clenzy.repository.OrgAiApiKeyRepository;
import com.clenzy.repository.PlatformAiFeatureModelRepository;
import com.clenzy.repository.PlatformAiFeatureProviderRepository;
import com.clenzy.repository.PlatformAiModelRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Tests de caractérisation du résolveur UNIQUE {@link AiTargetResolver}.
 *
 * <p>Prouve l'équivalence stricte avec les deux résolveurs historiques fusionnés :</p>
 * <ul>
 *   <li>{@code resolve} reproduit l'ancien {@code AiKeyResolver.resolve} (one-shot, throw) ;</li>
 *   <li>{@code resolvePrimary} reproduit l'ancien {@code AssistantTargetResolver.resolve}
 *       (streaming, cible gracieuse) ;</li>
 *   <li>{@code resolveChain} reproduit l'ancien {@code AssistantTargetResolver.resolveFailoverChain}.</li>
 * </ul>
 */
class AiTargetResolverTest {

    private OrgAiApiKeyRepository orgAiApiKeyRepository;
    private PlatformAiFeatureModelRepository platformAiFeatureModelRepository;
    private PlatformAiFeatureProviderRepository platformAiFeatureProviderRepository;
    private PlatformAiModelRepository platformAiModelRepository;
    private AiProperties aiProperties;
    private AiTargetResolver resolver;

    private static final Long ORG_ID = 1L;
    private static final String ORG_KEY = "sk-org-key-456";

    @BeforeEach
    void setUp() {
        orgAiApiKeyRepository = mock(OrgAiApiKeyRepository.class);
        platformAiFeatureModelRepository = mock(PlatformAiFeatureModelRepository.class);
        platformAiFeatureProviderRepository = mock(PlatformAiFeatureProviderRepository.class);
        platformAiModelRepository = mock(PlatformAiModelRepository.class);
        aiProperties = new AiProperties();
        resolver = new AiTargetResolver(orgAiApiKeyRepository, platformAiFeatureModelRepository,
                platformAiFeatureProviderRepository, platformAiModelRepository, aiProperties);

        // Défauts « rien de configuré » (les tests surchargent au besoin).
        when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(anyLong(), anyString()))
                .thenReturn(Optional.empty());
        lenient().when(platformAiFeatureProviderRepository.findByFeature(anyString()))
                .thenReturn(Optional.empty());
        lenient().when(platformAiFeatureModelRepository.findByFeature(anyString()))
                .thenReturn(Optional.empty());
        lenient().when(platformAiModelRepository.findAll()).thenReturn(List.of());
    }

    /** Modèle configuré utilisable (clé + statut AVAILABLE). */
    private static PlatformAiModel model(String name, String provider, String modelId, String key, String baseUrl) {
        PlatformAiModel m = new PlatformAiModel(name, provider, modelId, key, baseUrl);
        m.setAvailabilityStatus(AiModelAvailability.AVAILABLE);
        return m;
    }

    private static OrgAiApiKey orgKey(String provider, String key, String modelOverride) {
        OrgAiApiKey k = new OrgAiApiKey(ORG_ID, provider, key);
        k.setValid(true);
        k.setModelOverride(modelOverride);
        return k;
    }

    // ════════════════════ ONE-SHOT : resolve() (ex-AiKeyResolver) ════════════════════

    @Nested
    @DisplayName("resolve() — one-shot")
    class Resolve {

        @Test
        @DisplayName("BYOK : clé org valide AVEC modèle → ORGANIZATION, baseUrl null")
        void whenOrgHasValidKey_returnsOrgKey() {
            when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(ORG_ID, "anthropic"))
                    .thenReturn(Optional.of(orgKey("anthropic", ORG_KEY, "claude-sonnet-4")));

            ResolvedTarget result = resolver.resolve(ORG_ID, "anthropic", null);

            assertEquals(ORG_KEY, result.apiKey());
            assertEquals("claude-sonnet-4", result.model());
            assertEquals(KeySource.ORGANIZATION, result.source());
            assertEquals("anthropic", result.provider());
            assertNull(result.baseUrl());
        }

        @Test
        @DisplayName("BYOK SANS modèle → ignorée, repli sur le modèle assigné à la feature (fix 500)")
        void byokWithoutModel_skipped_fallsBackToFeatureModel() {
            // Cas réel : clé BYOK Anthropic de l'org sans modelOverride + modèle assigné à DESIGN.
            // La BYOK incomplète ne doit PAS masquer le modèle feature (sinon modèle null → 500).
            when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(ORG_ID, "anthropic"))
                    .thenReturn(Optional.of(orgKey("anthropic", "ant-key", null)));
            PlatformAiModel m = model("Llama", "nvidia", "llama-3.3-70b", "nv-key", "https://nvidia/v1");
            when(platformAiFeatureModelRepository.findByFeature("DESIGN"))
                    .thenReturn(Optional.of(new PlatformAiFeatureModel("DESIGN", m)));

            ResolvedTarget result = resolver.resolve(ORG_ID, "anthropic", AiFeature.DESIGN);

            assertEquals(KeySource.PLATFORM_DB, result.source());
            assertEquals("nvidia", result.provider());
            assertEquals("llama-3.3-70b", result.model());
            assertEquals("nv-key", result.apiKey());
        }

        @Test
        @DisplayName("BYOK SANS modèle ET aucun modèle configuré → AiNotConfiguredException")
        void byokWithoutModel_andNothingElse_throws() {
            when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(ORG_ID, "anthropic"))
                    .thenReturn(Optional.of(orgKey("anthropic", "ant-key", null)));

            assertThrows(AiNotConfiguredException.class,
                    () -> resolver.resolve(ORG_ID, "anthropic", AiFeature.DESIGN));
        }

        @Test
        @DisplayName("BYOK : model override de la clé org")
        void whenOrgHasKeyWithModelOverride_returnsModelOverride() {
            when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(ORG_ID, "anthropic"))
                    .thenReturn(Optional.of(orgKey("anthropic", ORG_KEY, "claude-haiku-4-20250514")));

            ResolvedTarget result = resolver.resolve(ORG_ID, "anthropic", null);

            assertEquals("claude-haiku-4-20250514", result.model());
            assertEquals(KeySource.ORGANIZATION, result.source());
        }

        @Test
        @DisplayName("modèle assigné à la feature (dispo) → PLATFORM_DB, provider/baseUrl du modèle")
        void featureModelAssignedAndAvailable_returnsPlatformDb() {
            PlatformAiModel m = model("Llama", "nvidia", "meta/llama-3.3-70b", "nv-key", "https://nvidia/v1");
            when(platformAiFeatureModelRepository.findByFeature("DESIGN"))
                    .thenReturn(Optional.of(new PlatformAiFeatureModel("DESIGN", m)));

            ResolvedTarget result = resolver.resolve(ORG_ID, "anthropic", AiFeature.DESIGN);

            assertEquals("nv-key", result.apiKey());
            assertEquals("meta/llama-3.3-70b", result.model());
            assertEquals(KeySource.PLATFORM_DB, result.source());
            assertEquals("nvidia", result.provider());
            assertEquals("https://nvidia/v1", result.baseUrl());
        }

        @Test
        @DisplayName("modèle assigné UNAVAILABLE → repli sur un autre modèle dispo")
        void featureModelUnavailable_fallsBackToAnotherAvailableModel() {
            PlatformAiModel dead = model("Dead", "nvidia", "dead-model", "nv-key", null);
            dead.setAvailabilityStatus(AiModelAvailability.UNAVAILABLE);
            PlatformAiModel alive = model("Mistral", "nvidia", "mistralai/mistral-large", "nv-key-2", null);
            when(platformAiFeatureModelRepository.findByFeature("DESIGN"))
                    .thenReturn(Optional.of(new PlatformAiFeatureModel("DESIGN", dead)));
            when(platformAiModelRepository.findAll()).thenReturn(List.of(dead, alive));

            ResolvedTarget result = resolver.resolve(ORG_ID, "anthropic", AiFeature.DESIGN);

            assertEquals("mistralai/mistral-large", result.model());
            assertEquals(KeySource.PLATFORM_DB, result.source());
        }

        @Test
        @DisplayName("feature sans modèle assigné → repli catalogue")
        void featureNotAssigned_fallsBackToAvailableModel() {
            PlatformAiModel alive = model("Llama", "nvidia", "meta/llama", "nv-key", null);
            when(platformAiModelRepository.findAll()).thenReturn(List.of(alive));

            ResolvedTarget result = resolver.resolve(ORG_ID, "anthropic", AiFeature.ANALYTICS);

            assertEquals(KeySource.PLATFORM_DB, result.source());
            assertEquals("meta/llama", result.model());
        }

        @Test
        @DisplayName("aucun modèle exploitable → AiNotConfiguredException")
        void noConfiguredModel_throwsAiNotConfigured() {
            AiNotConfiguredException ex = assertThrows(AiNotConfiguredException.class,
                    () -> resolver.resolve(ORG_ID, "anthropic", AiFeature.DESIGN));
            assertEquals("AI_NOT_CONFIGURED", ex.getErrorCode());
        }

        @Test
        @DisplayName("tous les modèles UNAVAILABLE → AiNotConfiguredException")
        void allModelsUnavailable_throws() {
            PlatformAiModel dead = model("Dead", "nvidia", "dead", "k", null);
            dead.setAvailabilityStatus(AiModelAvailability.UNAVAILABLE);
            when(platformAiModelRepository.findAll()).thenReturn(List.of(dead));

            assertThrows(AiNotConfiguredException.class,
                    () -> resolver.resolve(ORG_ID, "anthropic", AiFeature.DESIGN));
        }

        @Test
        @DisplayName("orgId null → pas de BYOK, repli catalogue")
        void whenOrgIdNull_usesConfiguredModel() {
            PlatformAiModel alive = model("Llama", "nvidia", "meta/llama", "nv-key", null);
            when(platformAiModelRepository.findAll()).thenReturn(List.of(alive));

            ResolvedTarget result = resolver.resolve(null, "anthropic", null);

            assertEquals(KeySource.PLATFORM_DB, result.source());
            verify(orgAiApiKeyRepository, never()).findByOrganizationIdAndProvider(anyLong(), anyString());
        }

        @Test
        @DisplayName("garde-fou : resolve() PROPAGE l'exception de lookup (pas de fail-safe one-shot)")
        void resolve_propagatesLookupException() {
            when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(ORG_ID, "anthropic"))
                    .thenThrow(new RuntimeException("db down"));

            assertThrows(RuntimeException.class,
                    () -> resolver.resolve(ORG_ID, "anthropic", AiFeature.DESIGN));
        }
    }

    @Nested
    @DisplayName("resolve() — override provider par feature")
    class ProviderOverride {

        @Test
        @DisplayName("override → clé BYOK du provider assigné (provider effectif)")
        void featureProviderOverride_usesOverriddenOrgKey() {
            when(platformAiFeatureProviderRepository.findByFeature("DESIGN"))
                    .thenReturn(Optional.of(new PlatformAiFeatureProvider("DESIGN", "openai")));
            when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(ORG_ID, "openai"))
                    .thenReturn(Optional.of(orgKey("openai", "sk-openai-org", "gpt-4o")));

            ResolvedTarget result = resolver.resolve(ORG_ID, "anthropic", AiFeature.DESIGN);

            assertEquals("sk-openai-org", result.apiKey());
            assertEquals(KeySource.ORGANIZATION, result.source());
            assertEquals("openai", result.provider());
        }

        @Test
        @DisplayName("override sans BYOK → repli catalogue (provider du modèle)")
        void featureProviderOverride_noByok_fallsBackToConfiguredModel() {
            when(platformAiFeatureProviderRepository.findByFeature("PRICING"))
                    .thenReturn(Optional.of(new PlatformAiFeatureProvider("PRICING", "openai")));
            PlatformAiModel alive = model("Llama", "nvidia", "meta/llama", "nv-key", null);
            when(platformAiModelRepository.findAll()).thenReturn(List.of(alive));

            ResolvedTarget result = resolver.resolve(ORG_ID, "anthropic", AiFeature.PRICING);

            assertEquals(KeySource.PLATFORM_DB, result.source());
            assertEquals("nvidia", result.provider());
        }
    }

    // ════════════════ STREAMING : resolvePrimary() (ex-AssistantTargetResolver.resolve) ════════════════

    @Nested
    @DisplayName("resolvePrimary() — streaming")
    class ResolvePrimary {

        @Test
        @DisplayName("rien de configuré → défaut Anthropic, clé null (gracieux), source PLATFORM_DB")
        void whenNothingConfigured_thenDefaultsToAnthropicNullKey() {
            ResolvedTarget target = resolver.resolvePrimary(ORG_ID, AiFeature.ASSISTANT_CHAT, null);

            assertEquals("anthropic", target.provider());
            assertNull(target.model());
            assertNull(target.apiKey());
            assertNull(target.baseUrl());
            assertEquals(KeySource.PLATFORM_DB, target.source());
        }

        @Test
        @DisplayName("BYOK Anthropic présent → clé + modelOverride BYOK")
        void whenAnthropicByokPresent_thenReturnsByok() {
            when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(ORG_ID, "anthropic"))
                    .thenReturn(Optional.of(orgKey("anthropic", "sk-ant-byok", "claude-haiku")));

            ResolvedTarget target = resolver.resolvePrimary(ORG_ID, AiFeature.ASSISTANT_CHAT, null);

            assertEquals("anthropic", target.provider());
            assertEquals("sk-ant-byok", target.apiKey());
            assertEquals("claude-haiku", target.model());
            assertEquals(KeySource.ORGANIZATION, target.source());
        }

        @Test
        @DisplayName("provider assigné + BYOK → BYOK prime, baseUrl par défaut du provider")
        void whenProviderAssignedWithByok_thenByokTakesPrecedence() {
            when(platformAiFeatureProviderRepository.findByFeature("ASSISTANT_CHAT"))
                    .thenReturn(Optional.of(new PlatformAiFeatureProvider("ASSISTANT_CHAT", "openai")));
            when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(ORG_ID, "openai"))
                    .thenReturn(Optional.of(orgKey("openai", "sk-openai-byok", "gpt-4o-mini")));

            ResolvedTarget target = resolver.resolvePrimary(ORG_ID, AiFeature.ASSISTANT_CHAT, null);

            assertEquals("openai", target.provider());
            assertEquals("sk-openai-byok", target.apiKey());
            assertEquals("gpt-4o-mini", target.model());
            assertEquals(aiProperties.getOpenai().getBaseUrl(), target.baseUrl());
        }

        @Test
        @DisplayName("provider assigné sans BYOK → repli sur le modèle plateforme assigné")
        void whenProviderAssignedWithoutByok_thenFallsBackToPlatformModel() {
            when(platformAiFeatureProviderRepository.findByFeature("ASSISTANT_CHAT"))
                    .thenReturn(Optional.of(new PlatformAiFeatureProvider("ASSISTANT_CHAT", "openai")));
            PlatformAiModel m = model("GPT", "openai", "gpt-4o-mini", "sk-openai-platform", "https://api.openai.com/v1");
            when(platformAiFeatureModelRepository.findByFeature("ASSISTANT_CHAT"))
                    .thenReturn(Optional.of(new PlatformAiFeatureModel("ASSISTANT_CHAT", m)));

            ResolvedTarget target = resolver.resolvePrimary(ORG_ID, AiFeature.ASSISTANT_CHAT, null);

            assertEquals("openai", target.provider());
            assertEquals("sk-openai-platform", target.apiKey());
            assertEquals("gpt-4o-mini", target.model());
            assertEquals("https://api.openai.com/v1", target.baseUrl());
            assertEquals(KeySource.PLATFORM_DB, target.source());
        }

        @Test
        @DisplayName("provider assigné, ni BYOK ni modèle plateforme → défaut clé null (pas de repli env)")
        void whenProviderAssignedAndNothingElse_thenDefaultsToNullKey() {
            aiProperties.getOpenai().setApiKey("sk-openai-env"); // doit être IGNORÉ
            when(platformAiFeatureProviderRepository.findByFeature("ASSISTANT_CHAT"))
                    .thenReturn(Optional.of(new PlatformAiFeatureProvider("ASSISTANT_CHAT", "openai")));

            ResolvedTarget target = resolver.resolvePrimary(ORG_ID, AiFeature.ASSISTANT_CHAT, null);

            assertEquals("anthropic", target.provider());
            assertNull(target.apiKey());
            assertNull(target.model());
        }

        @Test
        @DisplayName("modèle plateforme assigné → provider/clé/baseUrl/modèle du modèle")
        void whenPlatformModelAssigned_thenReturnsModel() {
            PlatformAiModel m = model("Llama", "nvidia", "llama-3.3-70b", "nvapi-key", "https://integrate.api.nvidia.com/v1");
            when(platformAiFeatureModelRepository.findByFeature("ASSISTANT_CHAT"))
                    .thenReturn(Optional.of(new PlatformAiFeatureModel("ASSISTANT_CHAT", m)));

            ResolvedTarget target = resolver.resolvePrimary(ORG_ID, AiFeature.ASSISTANT_CHAT, null);

            assertEquals("nvidia", target.provider());
            assertEquals("llama-3.3-70b", target.model());
            assertEquals("nvapi-key", target.apiKey());
            assertEquals("https://integrate.api.nvidia.com/v1", target.baseUrl());
        }

        @Test
        @DisplayName("modèle assigné UNAVAILABLE → ignoré (P0-A), défaut clé null")
        void whenAssignedModelUnavailable_thenSkipped() {
            PlatformAiModel dead = model("Dead", "nvidia", "dead", "nvapi-key", null);
            dead.setAvailabilityStatus(AiModelAvailability.UNAVAILABLE);
            when(platformAiFeatureModelRepository.findByFeature("ASSISTANT_CHAT"))
                    .thenReturn(Optional.of(new PlatformAiFeatureModel("ASSISTANT_CHAT", dead)));

            ResolvedTarget target = resolver.resolvePrimary(ORG_ID, AiFeature.ASSISTANT_CHAT, null);

            assertNull(target.apiKey());
            assertEquals("anthropic", target.provider());
        }

        @Test
        @DisplayName("contextModelOverride prime sur le modèle résolu")
        void whenContextModelOverridePresent_thenItPrimes() {
            when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(ORG_ID, "anthropic"))
                    .thenReturn(Optional.of(orgKey("anthropic", "sk-ant-byok", "claude-sonnet")));

            ResolvedTarget target = resolver.resolvePrimary(ORG_ID, AiFeature.ASSISTANT_CHAT, "claude-haiku-brief");

            assertEquals("claude-haiku-brief", target.model());
            assertEquals("sk-ant-byok", target.apiKey());
        }

        @Test
        @DisplayName("garde-fou : lookup qui throw → fail-safe gracieux (Anthropic clé null)")
        void whenLookupThrows_thenFailsSafeToAnthropicDefault() {
            when(platformAiFeatureProviderRepository.findByFeature(anyString()))
                    .thenThrow(new RuntimeException("db down"));
            when(platformAiFeatureModelRepository.findByFeature(anyString()))
                    .thenThrow(new RuntimeException("db down"));
            when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(anyLong(), anyString()))
                    .thenThrow(new RuntimeException("db down"));

            ResolvedTarget target = resolver.resolvePrimary(ORG_ID, AiFeature.ASSISTANT_CHAT, null);

            assertEquals("anthropic", target.provider());
            assertNull(target.apiKey());
        }
    }

    // ════════════════ STREAMING : resolveChain() (ex-resolveFailoverChain) ════════════════

    @Nested
    @DisplayName("resolveChain() — failover")
    class ResolveChain {

        @Test
        @DisplayName("primaire + replis canoniques [anthropic, openai] dans l'ordre")
        void chain_primaryThenCanonicalFallbacks() {
            // Primaire = modèle plateforme nvidia ; replis BYOK anthropic + openai.
            PlatformAiModel nvidia = model("Llama", "nvidia", "llama-3.3-70b", "nvapi", "https://nvidia/v1");
            when(platformAiFeatureModelRepository.findByFeature("ASSISTANT_CHAT"))
                    .thenReturn(Optional.of(new PlatformAiFeatureModel("ASSISTANT_CHAT", nvidia)));
            when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(ORG_ID, "anthropic"))
                    .thenReturn(Optional.of(orgKey("anthropic", "ant-key", "claude-sonnet")));
            when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(ORG_ID, "openai"))
                    .thenReturn(Optional.of(orgKey("openai", "oai-key", "gpt-4o")));

            List<ResolvedTarget> chain = resolver.resolveChain(ORG_ID, AiFeature.ASSISTANT_CHAT, null);

            assertEquals(3, chain.size());
            assertEquals("nvidia", chain.get(0).provider());
            assertEquals("anthropic", chain.get(1).provider());
            assertEquals("openai", chain.get(2).provider());
        }

        @Test
        @DisplayName("dédup : si le primaire est anthropic, anthropic n'est pas re-ajouté")
        void chain_dedupPrimaryProvider() {
            when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(ORG_ID, "anthropic"))
                    .thenReturn(Optional.of(orgKey("anthropic", "ant-key", "claude-x")));
            // openai dispo en repli plateforme.
            PlatformAiModel openai = model("GPT", "openai", "gpt-4o", "oai-key", "https://api.openai.com/v1");
            when(platformAiModelRepository.findAll()).thenReturn(List.of(openai));

            List<ResolvedTarget> chain = resolver.resolveChain(ORG_ID, AiFeature.ASSISTANT_CHAT, null);

            // primaire = anthropic (BYOK), repli = openai uniquement (anthropic dédupliqué).
            assertEquals("anthropic", chain.get(0).provider());
            assertThat(chain).hasSize(2);
            assertEquals("openai", chain.get(1).provider());
        }

        @Test
        @DisplayName("garde-fou : ctxModel appliqué au primaire mais PAS aux replis")
        void chain_ctxModelNotAppliedToFallbacks() {
            PlatformAiModel nvidia = model("Llama", "nvidia", "llama-3.3-70b", "nvapi", "https://nvidia/v1");
            when(platformAiFeatureModelRepository.findByFeature("ASSISTANT_CHAT"))
                    .thenReturn(Optional.of(new PlatformAiFeatureModel("ASSISTANT_CHAT", nvidia)));
            when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(ORG_ID, "anthropic"))
                    .thenReturn(Optional.of(orgKey("anthropic", "ant-key", "claude-sonnet")));

            List<ResolvedTarget> chain = resolver.resolveChain(ORG_ID, AiFeature.ASSISTANT_CHAT, "haiku-brief");

            // Primaire : ctxModel prime.
            assertEquals("haiku-brief", chain.get(0).model());
            // Repli anthropic : garde le modelOverride BYOK, PAS le ctxModel.
            assertEquals("anthropic", chain.get(1).provider());
            assertEquals("claude-sonnet", chain.get(1).model());
        }

        @Test
        @DisplayName("aucun repli utilisable → chaîne = primaire seul")
        void chain_noFallbacks_onlyPrimary() {
            when(orgAiApiKeyRepository.findByOrganizationIdAndProvider(ORG_ID, "anthropic"))
                    .thenReturn(Optional.of(orgKey("anthropic", "ant-key", "claude-x")));
            // Aucun openai dispo → pas de repli ; anthropic dédupliqué.
            List<ResolvedTarget> chain = resolver.resolveChain(ORG_ID, AiFeature.ASSISTANT_CHAT, null);

            assertEquals(1, chain.size());
            assertEquals("anthropic", chain.get(0).provider());
        }
    }
}
