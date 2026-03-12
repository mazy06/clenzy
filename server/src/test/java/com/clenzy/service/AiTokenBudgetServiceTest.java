package com.clenzy.service;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.AiResponse;
import com.clenzy.dto.AiUsageStatsDto;
import com.clenzy.model.AiFeature;
import com.clenzy.model.AiTokenBudget;
import com.clenzy.repository.AiTokenBudgetRepository;
import com.clenzy.repository.AiTokenUsageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AiTokenBudgetServiceTest {

    private AiProperties aiProperties;
    private AiTokenBudgetRepository budgetRepository;
    private AiTokenUsageRepository usageRepository;
    private AiTokenBudgetService service;

    @BeforeEach
    void setUp() {
        aiProperties = new AiProperties();
        aiProperties.getTokenBudget().setDefaultMonthlyTokens(100_000);
        aiProperties.getTokenBudget().setEnforced(true);

        budgetRepository = mock(AiTokenBudgetRepository.class);
        usageRepository = mock(AiTokenUsageRepository.class);
        service = spy(new AiTokenBudgetService(aiProperties, budgetRepository, usageRepository));

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

            IllegalStateException ex = assertThrows(IllegalStateException.class,
                    () -> service.requireBudget(1L, AiFeature.SENTIMENT));

            assertTrue(ex.getMessage().contains("budget exceeded"));
            assertTrue(ex.getMessage().contains("SENTIMENT"));
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
            assertEquals(11_000L, stats.totalUsed());
            assertEquals(500_000L, stats.totalBudget()); // 5 features * 100k default
            assertEquals("2026-03", stats.monthYear());
        }
    }
}
