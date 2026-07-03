package com.clenzy.service;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.AiResponse;
import com.clenzy.dto.AiFeatureUsageBreakdownDto;
import com.clenzy.dto.AiUsageStatsDto;
import com.clenzy.exception.AiBudgetExceededException;
import com.clenzy.model.AiFeature;
import com.clenzy.model.AiTokenBudget;
import com.clenzy.model.AiTokenUsage;
import com.clenzy.repository.AiTokenBudgetRepository;
import com.clenzy.repository.AiTokenUsageRepository;
import com.clenzy.service.ai.LlmPricingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AiTokenBudgetServiceTest {

    private AiProperties aiProperties;
    private AiTokenBudgetRepository budgetRepository;
    private AiTokenUsageRepository usageRepository;
    private LlmPricingService pricingService;
    private AiTokenBudgetService service;

    @BeforeEach
    void setUp() {
        aiProperties = new AiProperties();
        aiProperties.getTokenBudget().setDefaultMonthlyTokens(100_000);
        aiProperties.getTokenBudget().setEnforced(true);

        budgetRepository = mock(AiTokenBudgetRepository.class);
        usageRepository = mock(AiTokenUsageRepository.class);
        pricingService = new LlmPricingService(); // real impl — pure stateless, no Spring needed
        service = spy(new AiTokenBudgetService(aiProperties, budgetRepository, usageRepository, pricingService));

        // Fix month for deterministic tests
        doReturn("2026-03").when(service).getCurrentMonthYear();
    }

    // ─── hasBudget ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("hasBudget()")
    class HasBudget {

        @Test
        void withinLimit_returnsTrue() {
            when(budgetRepository.findByOrganizationIdAndFeature(1L, AiFeature.PRICING))
                    .thenReturn(Optional.empty()); // uses default 100k
            when(usageRepository.sumTokensByOrgAndFeatureAndMonth(1L, AiFeature.PRICING, "2026-03"))
                    .thenReturn(50_000L);

            assertTrue(service.hasBudget(1L, AiFeature.PRICING));
        }

        @Test
        void exceededLimit_returnsFalse() {
            when(budgetRepository.findByOrganizationIdAndFeature(1L, AiFeature.PRICING))
                    .thenReturn(Optional.empty());
            when(usageRepository.sumTokensByOrgAndFeatureAndMonth(1L, AiFeature.PRICING, "2026-03"))
                    .thenReturn(100_001L);

            assertFalse(service.hasBudget(1L, AiFeature.PRICING));
        }

        @Test
        void exactlyAtLimit_returnsFalse() {
            when(budgetRepository.findByOrganizationIdAndFeature(1L, AiFeature.MESSAGING))
                    .thenReturn(Optional.empty());
            when(usageRepository.sumTokensByOrgAndFeatureAndMonth(1L, AiFeature.MESSAGING, "2026-03"))
                    .thenReturn(100_000L);

            assertFalse(service.hasBudget(1L, AiFeature.MESSAGING));
        }

        @Test
        void enforcementDisabled_alwaysTrue() {
            aiProperties.getTokenBudget().setEnforced(false);

            // No repository calls needed
            assertTrue(service.hasBudget(1L, AiFeature.PRICING));
            verifyNoInteractions(usageRepository);
        }

        @Test
        void customBudget_usesOrgLimit() {
            AiTokenBudget customBudget = new AiTokenBudget(1L, AiFeature.ANALYTICS, 50_000);
            when(budgetRepository.findByOrganizationIdAndFeature(1L, AiFeature.ANALYTICS))
                    .thenReturn(Optional.of(customBudget));
            when(usageRepository.sumTokensByOrgAndFeatureAndMonth(1L, AiFeature.ANALYTICS, "2026-03"))
                    .thenReturn(49_999L);

            assertTrue(service.hasBudget(1L, AiFeature.ANALYTICS));
        }

        @Test
        void disabledBudgetEntry_fallsBackToDefault() {
            AiTokenBudget disabledBudget = new AiTokenBudget(1L, AiFeature.ANALYTICS, 10);
            disabledBudget.setEnabled(false);
            when(budgetRepository.findByOrganizationIdAndFeature(1L, AiFeature.ANALYTICS))
                    .thenReturn(Optional.of(disabledBudget));
            when(usageRepository.sumTokensByOrgAndFeatureAndMonth(1L, AiFeature.ANALYTICS, "2026-03"))
                    .thenReturn(50_000L); // under 100k default

            assertTrue(service.hasBudget(1L, AiFeature.ANALYTICS));
        }
    }

    // ─── requireBudget ──────────────────────────────────────────────────

    @Nested
    @DisplayName("requireBudget()")
    class RequireBudget {

        @Test
        void overLimit_throwsException() {
            when(budgetRepository.findByOrganizationIdAndFeature(1L, AiFeature.SENTIMENT))
                    .thenReturn(Optional.empty());
            when(usageRepository.sumTokensByOrgAndFeatureAndMonth(1L, AiFeature.SENTIMENT, "2026-03"))
                    .thenReturn(200_000L);

            AiBudgetExceededException ex = assertThrows(AiBudgetExceededException.class,
                    () -> service.requireBudget(1L, AiFeature.SENTIMENT));

            assertEquals("AI_BUDGET_EXCEEDED", ex.getErrorCode());
            assertEquals("SENTIMENT", ex.getFeature());
            assertEquals(200_000L, ex.getUsed());
            assertEquals(100_000L, ex.getLimit());
        }

        @Test
        void withinLimit_doesNotThrow() {
            when(budgetRepository.findByOrganizationIdAndFeature(1L, AiFeature.DESIGN))
                    .thenReturn(Optional.empty());
            when(usageRepository.sumTokensByOrgAndFeatureAndMonth(1L, AiFeature.DESIGN, "2026-03"))
                    .thenReturn(10_000L);

            assertDoesNotThrow(() -> service.requireBudget(1L, AiFeature.DESIGN));
        }
    }

    // ─── recordUsage ────────────────────────────────────────────────────

    @Nested
    @DisplayName("recordUsage()")
    class RecordUsage {

        @Test
        void persistsCorrectly() {
            AiResponse response = new AiResponse("hello", 100, 50, 150, "gpt-4o", "stop");

            service.recordUsage(1L, AiFeature.PRICING, "openai", response);

            var captor = ArgumentCaptor.forClass(com.clenzy.model.AiTokenUsage.class);
            verify(usageRepository).save(captor.capture());

            var saved = captor.getValue();
            assertEquals(1L, saved.getOrganizationId());
            assertEquals(AiFeature.PRICING, saved.getFeature());
            assertEquals("openai", saved.getProvider());
            assertEquals("gpt-4o", saved.getModel());
            assertEquals(100, saved.getPromptTokens());
            assertEquals(50, saved.getCompletionTokens());
            assertEquals(150, saved.getTotalTokens());
            assertEquals("2026-03", saved.getMonthYear());
        }
    }

    // ─── getUsageStats ──────────────────────────────────────────────────

    @Nested
    @DisplayName("getUsageStats()")
    class GetUsageStats {

        @Test
        void returnsAggregatedStats() {
            when(budgetRepository.findByOrganizationIdAndFeature(eq(1L), any(AiFeature.class)))
                    .thenReturn(Optional.empty()); // all use default 100k
            when(usageRepository.sumTokensByOrgAndFeatureAndMonth(eq(1L), eq(AiFeature.PRICING), eq("2026-03")))
                    .thenReturn(5_000L);
            when(usageRepository.sumTokensByOrgAndFeatureAndMonth(eq(1L), eq(AiFeature.MESSAGING), eq("2026-03")))
                    .thenReturn(3_000L);
            when(usageRepository.sumTokensByOrgAndFeatureAndMonth(eq(1L), eq(AiFeature.ANALYTICS), eq("2026-03")))
                    .thenReturn(0L);
            when(usageRepository.sumTokensByOrgAndFeatureAndMonth(eq(1L), eq(AiFeature.SENTIMENT), eq("2026-03")))
                    .thenReturn(1_000L);
            when(usageRepository.sumTokensByOrgAndFeatureAndMonth(eq(1L), eq(AiFeature.DESIGN), eq("2026-03")))
                    .thenReturn(2_000L);

            AiUsageStatsDto stats = service.getUsageStats(1L);

            assertEquals(5_000L, stats.usageByFeature().get("PRICING"));
            assertEquals(3_000L, stats.usageByFeature().get("MESSAGING"));
            assertEquals(0L, stats.usageByFeature().get("ANALYTICS"));
            assertEquals(1_000L, stats.usageByFeature().get("SENTIMENT"));
            assertEquals(2_000L, stats.usageByFeature().get("DESIGN"));
            // ASSISTANT_CHAT ajoute (audit pre-prod 2026-05) — meme defaut 100k
            assertEquals(0L, stats.usageByFeature().get("ASSISTANT_CHAT"));
            // CONTENT ajoute (BE-L0-2, generation de contenu) — meme defaut 100k
            assertEquals(0L, stats.usageByFeature().get("CONTENT"));
            // STUDIO_ASSIST ajoute (champ IA du Studio booking engine / livret) — meme defaut 100k
            assertEquals(0L, stats.usageByFeature().get("STUDIO_ASSIST"));
            // EMBEDDINGS ajoute (P1-A, RAG via config DB) — meme defaut 100k
            assertEquals(0L, stats.usageByFeature().get("EMBEDDINGS"));
            assertEquals(11_000L, stats.totalUsed());
            // 11 features * 100k default (ASSISTANT_SMALL/STRONG ajoutees le 2026-07-02 :
            // tiers de l'assistant pilotes par la config DB — cf. TierModelResolver)
            assertEquals(AiFeature.values().length * 100_000L, stats.totalBudget());
            assertEquals("2026-03", stats.monthYear());
        }
    }

    // ─── getUsageBreakdown ──────────────────────────────────────────────

    @Nested
    @DisplayName("getUsageBreakdown()")
    class GetUsageBreakdown {

        @Test
        void groupsByProviderAndModel_andSortsByCostDesc() {
            // ASSISTANT_CHAT : 2 appels Sonnet + 1 appel Haiku
            AiTokenUsage sonnet1 = new AiTokenUsage(1L, AiFeature.ASSISTANT_CHAT, "anthropic",
                    "claude-sonnet-4-20250514", 80_000, 10_000, 90_000, "2026-03");
            AiTokenUsage sonnet2 = new AiTokenUsage(1L, AiFeature.ASSISTANT_CHAT, "anthropic",
                    "claude-sonnet-4-20250514", 60_000, 8_000, 68_000, "2026-03");
            AiTokenUsage haiku = new AiTokenUsage(1L, AiFeature.ASSISTANT_CHAT, "anthropic",
                    "claude-haiku-4-5", 20_000, 3_000, 23_000, "2026-03");
            // DESIGN : 1 appel modele inconnu
            AiTokenUsage unknown = new AiTokenUsage(1L, AiFeature.DESIGN, "nvidia",
                    "qwen3-coder-480b", 50_000, 8_000, 58_000, "2026-03");

            when(usageRepository.findByOrganizationIdAndMonthYear(1L, "2026-03"))
                    .thenReturn(List.of(sonnet1, sonnet2, haiku, unknown));

            AiFeatureUsageBreakdownDto result = service.getUsageBreakdown(1L);

            assertEquals("2026-03", result.monthYear());
            // Toutes les features presentes (init pour stabilite UI)
            assertTrue(result.breakdownByFeature().containsKey("PRICING"));
            assertTrue(result.breakdownByFeature().get("PRICING").isEmpty());

            // ASSISTANT_CHAT : 2 groupes (sonnet aggrege + haiku), Sonnet > Haiku en cost
            List<AiFeatureUsageBreakdownDto.ModelUsage> assistant =
                    result.breakdownByFeature().get("ASSISTANT_CHAT");
            assertEquals(2, assistant.size());

            AiFeatureUsageBreakdownDto.ModelUsage first = assistant.get(0);
            assertEquals("claude-sonnet-4-20250514", first.model());
            assertEquals(140_000L, first.tokensIn()); // 80k + 60k
            assertEquals(18_000L,  first.tokensOut()); // 10k + 8k
            assertEquals(2L,       first.callCount());
            // Sonnet: 140k * $3/Mtok + 18k * $15/Mtok = $0.42 + $0.27 = $0.69
            assertEquals(0, first.costUsd().compareTo(new java.math.BigDecimal("0.690000")));

            AiFeatureUsageBreakdownDto.ModelUsage second = assistant.get(1);
            assertEquals("claude-haiku-4-5", second.model());
            assertEquals(20_000L, second.tokensIn());
            // Haiku 4: 20k * $0.80/Mtok + 3k * $4/Mtok = $0.016 + $0.012 = $0.028
            assertEquals(0, second.costUsd().compareTo(new java.math.BigDecimal("0.028000")));

            // Sonnet plus cher => en premier
            assertTrue(first.costUsd().compareTo(second.costUsd()) > 0);

            // DESIGN: modele inconnu => cost zero, mais entree presente
            List<AiFeatureUsageBreakdownDto.ModelUsage> design = result.breakdownByFeature().get("DESIGN");
            assertEquals(1, design.size());
            assertEquals("qwen3-coder-480b", design.get(0).model());
            assertEquals(0, design.get(0).costUsd().compareTo(java.math.BigDecimal.ZERO.setScale(6)));
        }

        @Test
        void noUsage_returnsEmptyListsPerFeature() {
            when(usageRepository.findByOrganizationIdAndMonthYear(1L, "2026-03"))
                    .thenReturn(List.of());

            AiFeatureUsageBreakdownDto result = service.getUsageBreakdown(1L);

            assertEquals("2026-03", result.monthYear());
            // Toutes les features de l'enum doivent etre presentes mais vides
            for (AiFeature f : AiFeature.values()) {
                assertTrue(result.breakdownByFeature().containsKey(f.name()),
                        "missing feature " + f.name());
                assertTrue(result.breakdownByFeature().get(f.name()).isEmpty());
            }
        }

        @Test
        void nullProviderOrModel_falsBackToUnknown() {
            AiTokenUsage anonymous = new AiTokenUsage(1L, AiFeature.PRICING, null,
                    null, 1_000, 200, 1_200, "2026-03");
            when(usageRepository.findByOrganizationIdAndMonthYear(1L, "2026-03"))
                    .thenReturn(List.of(anonymous));

            AiFeatureUsageBreakdownDto result = service.getUsageBreakdown(1L);
            List<AiFeatureUsageBreakdownDto.ModelUsage> pricing =
                    result.breakdownByFeature().get("PRICING");

            assertEquals(1, pricing.size());
            assertEquals("unknown", pricing.get(0).provider());
            assertEquals("unknown", pricing.get(0).model());
        }
    }

    // ─── feature toggles ───────────────────────────────────────────────

    @org.junit.jupiter.api.Nested
    @org.junit.jupiter.api.DisplayName("isFeatureEnabled / requireFeatureEnabled")
    class FeatureEnabled {
        @Test
        void whenNoBudgetEntry_thenEnabledByDefault() {
            when(budgetRepository.findByOrganizationIdAndFeature(1L, AiFeature.PRICING))
                    .thenReturn(Optional.empty());

            assertTrue(service.isFeatureEnabled(1L, AiFeature.PRICING));
            assertDoesNotThrow(() -> service.requireFeatureEnabled(1L, AiFeature.PRICING));
        }

        @Test
        void whenBudgetEnabled_thenReturnsTrue() {
            AiTokenBudget b = new AiTokenBudget(1L, AiFeature.PRICING, 100_000);
            b.setEnabled(true);
            when(budgetRepository.findByOrganizationIdAndFeature(1L, AiFeature.PRICING))
                    .thenReturn(Optional.of(b));

            assertTrue(service.isFeatureEnabled(1L, AiFeature.PRICING));
        }

        @Test
        void whenBudgetDisabled_thenReturnsFalseAndRequireThrows() {
            AiTokenBudget b = new AiTokenBudget(1L, AiFeature.PRICING, 100_000);
            b.setEnabled(false);
            when(budgetRepository.findByOrganizationIdAndFeature(1L, AiFeature.PRICING))
                    .thenReturn(Optional.of(b));

            assertFalse(service.isFeatureEnabled(1L, AiFeature.PRICING));

            com.clenzy.exception.AiNotConfiguredException ex = assertThrows(
                    com.clenzy.exception.AiNotConfiguredException.class,
                    () -> service.requireFeatureEnabled(1L, AiFeature.PRICING));
            assertEquals("AI_FEATURE_DISABLED", ex.getErrorCode());
        }
    }

    @org.junit.jupiter.api.Nested
    @org.junit.jupiter.api.DisplayName("getFeatureToggles")
    class GetFeatureToggles {
        @Test
        void returnsAllFeaturesWithDbStateOrTrue() {
            AiTokenBudget pricing = new AiTokenBudget(1L, AiFeature.PRICING, 100_000);
            pricing.setEnabled(false);
            AiTokenBudget msg = new AiTokenBudget(1L, AiFeature.MESSAGING, 100_000);
            msg.setEnabled(true);

            when(budgetRepository.findByOrganizationId(1L))
                    .thenReturn(List.of(pricing, msg));

            java.util.Map<AiFeature, Boolean> toggles = service.getFeatureToggles(1L);

            assertEquals(AiFeature.values().length, toggles.size());
            assertFalse(toggles.get(AiFeature.PRICING));
            assertTrue(toggles.get(AiFeature.MESSAGING));
            assertTrue(toggles.get(AiFeature.SENTIMENT)); // default true
        }
    }

    @org.junit.jupiter.api.Nested
    @org.junit.jupiter.api.DisplayName("setFeatureEnabled")
    class SetFeatureEnabled {
        @Test
        void whenExistingBudget_thenUpdates() {
            AiTokenBudget existing = new AiTokenBudget(1L, AiFeature.PRICING, 100_000);
            existing.setEnabled(true);
            when(budgetRepository.findByOrganizationIdAndFeature(1L, AiFeature.PRICING))
                    .thenReturn(Optional.of(existing));

            service.setFeatureEnabled(1L, AiFeature.PRICING, false);

            assertFalse(existing.isEnabled());
            verify(budgetRepository).save(existing);
        }

        @Test
        void whenNoBudget_thenCreatesNew() {
            when(budgetRepository.findByOrganizationIdAndFeature(1L, AiFeature.SENTIMENT))
                    .thenReturn(Optional.empty());

            service.setFeatureEnabled(1L, AiFeature.SENTIMENT, false);

            org.mockito.ArgumentCaptor<AiTokenBudget> captor =
                    org.mockito.ArgumentCaptor.forClass(AiTokenBudget.class);
            verify(budgetRepository).save(captor.capture());
            assertFalse(captor.getValue().isEnabled());
            assertEquals(AiFeature.SENTIMENT, captor.getValue().getFeature());
        }
    }

    @org.junit.jupiter.api.Nested
    @org.junit.jupiter.api.DisplayName("requireBudget(orgId, feature, keySource)")
    class RequireBudgetWithKeySource {
        @Test
        void whenOrganizationKey_thenSkipsEnforcement() {
            // No stubbing needed — should short-circuit
            assertDoesNotThrow(() -> service.requireBudget(1L, AiFeature.PRICING,
                    com.clenzy.service.KeySource.ORGANIZATION));
        }

        @Test
        void whenPlatformKey_thenChecksBudget() {
            when(budgetRepository.findByOrganizationIdAndFeature(1L, AiFeature.PRICING))
                    .thenReturn(Optional.empty());
            when(usageRepository.sumTokensByOrgAndFeatureAndMonth(1L, AiFeature.PRICING, "2026-03"))
                    .thenReturn(200_000L);

            assertThrows(com.clenzy.exception.AiBudgetExceededException.class,
                    () -> service.requireBudget(1L, AiFeature.PRICING,
                            com.clenzy.service.KeySource.PLATFORM_DB));
        }
    }
}
