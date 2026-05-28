package com.clenzy.service.ai;

import com.clenzy.config.AiProperties;
import com.clenzy.dto.AssistantUsageDto;
import com.clenzy.model.AiFeature;
import com.clenzy.model.AiTokenUsage;
import com.clenzy.model.AssistantMessage;
import com.clenzy.repository.AiTokenUsageRepository;
import com.clenzy.repository.AssistantMessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AssistantUsageServiceTest {

    private AiTokenUsageRepository usageRepo;
    private AssistantMessageRepository msgRepo;
    private LlmPricingService pricing;
    private AiProperties aiProps;
    private AssistantUsageService service;

    @BeforeEach
    void setUp() {
        usageRepo = mock(AiTokenUsageRepository.class);
        msgRepo = mock(AssistantMessageRepository.class);
        pricing = new LlmPricingService();  // vrai pricing pour tester les conversions
        aiProps = new AiProperties();
        Clock fixedClock = Clock.fixed(Instant.parse("2026-05-28T10:00:00Z"), ZoneOffset.UTC);
        service = new AssistantUsageService(usageRepo, msgRepo, pricing, aiProps, fixedClock);
    }

    @Test
    void empty_period_returns_zero_dto_without_crash() {
        when(usageRepo.findByOrganizationIdAndFeatureAndMonthYear(
                eq(1L), eq(AiFeature.ASSISTANT_CHAT), anyString()))
                .thenReturn(List.of());

        AssistantUsageDto dto = service.getUsage(1L, "month");

        assertThat(dto.tokensIn()).isZero();
        assertThat(dto.tokensOut()).isZero();
        assertThat(dto.costUsd()).isEqualByComparingTo("0");
        assertThat(dto.byModel()).isEmpty();
        assertThat(dto.requestCount()).isZero();
        assertThat(dto.period()).isEqualTo("month");
    }

    @Test
    void aggregates_two_records_same_model_sums_correctly() {
        AiTokenUsage r1 = makeUsage("claude-sonnet-4-20250514", 100, 50);
        AiTokenUsage r2 = makeUsage("claude-sonnet-4-20250514", 200, 80);
        when(usageRepo.findByOrganizationIdAndFeatureAndMonthYear(
                anyLong(), any(), anyString())).thenReturn(List.of(r1, r2));

        AssistantUsageDto dto = service.getUsage(1L, "month");

        assertThat(dto.tokensIn()).isEqualTo(300);
        assertThat(dto.tokensOut()).isEqualTo(130);
        assertThat(dto.requestCount()).isEqualTo(2);
        assertThat(dto.byModel()).hasSize(1);
        // 300 * 3 / 1M + 130 * 15 / 1M = 0.0009 + 0.00195 = 0.002850
        assertThat(dto.costUsd()).isEqualByComparingTo("0.002850");
    }

    @Test
    void aggregates_multiple_models_breakdown_sorted_by_cost_desc() {
        AiTokenUsage sonnet = makeUsage("claude-sonnet-4", 1000, 500);
        AiTokenUsage haiku = makeUsage("claude-haiku-4-5", 10000, 5000);
        when(usageRepo.findByOrganizationIdAndFeatureAndMonthYear(
                anyLong(), any(), anyString())).thenReturn(List.of(sonnet, haiku));

        AssistantUsageDto dto = service.getUsage(1L, "month");

        assertThat(dto.byModel()).hasSize(2);
        // Sonnet plus cher : 1000 * 3 + 500 * 15 = 3000 + 7500 = 10500 micro$
        // Haiku : 10000 * 0.8 + 5000 * 4 = 8000 + 20000 = 28000 micro$
        // Donc Haiku en premier (plus cher au total)
        assertThat(dto.byModel().get(0).model()).isEqualTo("claude-haiku-4-5");
        assertThat(dto.byModel().get(1).model()).isEqualTo("claude-sonnet-4");
    }

    @Test
    void today_period_queries_since_start_of_day() {
        when(usageRepo.findByOrgAndFeatureSince(eq(1L), eq(AiFeature.ASSISTANT_CHAT), any()))
                .thenReturn(List.of(makeUsage("claude-sonnet-4", 100, 50)));

        AssistantUsageDto dto = service.getUsage(1L, "today");

        assertThat(dto.tokensIn()).isEqualTo(100);
        assertThat(dto.period()).isEqualTo("today");
    }

    @Test
    void monthly_budget_propagated_from_aiProperties() {
        when(usageRepo.findByOrganizationIdAndFeatureAndMonthYear(
                anyLong(), any(), anyString())).thenReturn(List.of());

        AssistantUsageDto dto = service.getUsage(1L, "month");

        // AiProperties().getTokenBudget().getDefaultMonthlyTokens() est defini en defaut
        assertThat(dto.monthlyBudget()).isNotNull();
    }

    @Test
    void conversation_usage_sums_assistant_message_tokens_only() {
        AssistantMessage user = AssistantMessage.user(1L, 1L, "hello");
        AssistantMessage assistant1 = AssistantMessage.assistant(1L, 1L, "reply 1", null);
        assistant1.setPromptTokens(100);
        assistant1.setCompletionTokens(50);
        AssistantMessage assistant2 = AssistantMessage.assistant(1L, 1L, "reply 2", null);
        assistant2.setPromptTokens(200);
        assistant2.setCompletionTokens(80);
        AssistantMessage tool = AssistantMessage.tool(1L, 1L, "tc-1", "{}");
        // tool n'a pas de promptTokens — doit etre ignore
        when(msgRepo.findByConversation(1L)).thenReturn(
                List.of(user, assistant1, tool, assistant2));

        AssistantUsageDto dto = service.getConversationUsage(1L, "kc-user");

        assertThat(dto.tokensIn()).isEqualTo(300);
        assertThat(dto.tokensOut()).isEqualTo(130);
        assertThat(dto.requestCount()).isEqualTo(2);
        assertThat(dto.period()).isEqualTo("conversation");
    }

    @Test
    void conversation_usage_with_no_messages_returns_zero() {
        when(msgRepo.findByConversation(1L)).thenReturn(List.of());

        AssistantUsageDto dto = service.getConversationUsage(1L, "kc");

        assertThat(dto.tokensIn()).isZero();
        assertThat(dto.byModel()).isEmpty();
    }

    @Test
    void null_period_defaults_to_month() {
        when(usageRepo.findByOrganizationIdAndFeatureAndMonthYear(
                anyLong(), any(), anyString())).thenReturn(List.of());

        AssistantUsageDto dto = service.getUsage(1L, null);

        assertThat(dto.period()).isEqualTo("month");
    }

    private AiTokenUsage makeUsage(String model, int promptTokens, int completionTokens) {
        return new AiTokenUsage(
                1L, AiFeature.ASSISTANT_CHAT, "anthropic", model,
                promptTokens, completionTokens,
                promptTokens + completionTokens, "2026-05"
        );
    }
}
