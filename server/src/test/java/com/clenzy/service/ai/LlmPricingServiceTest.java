package com.clenzy.service.ai;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class LlmPricingServiceTest {

    private final LlmPricingService pricing = new LlmPricingService();

    @Test
    void sonnet_4_pricing_matches_anthropic_published_rates() {
        // 1M input tokens @ $3 + 1M output @ $15 = $18
        BigDecimal cost = pricing.computeCost("claude-sonnet-4-20250514",
                1_000_000L, 1_000_000L);
        assertThat(cost).isEqualByComparingTo("18.00");
    }

    @Test
    void haiku_4_5_pricing_matches_anthropic_published_rates() {
        // 1M input @ $0.80 + 1M output @ $4 = $4.80
        BigDecimal cost = pricing.computeCost("claude-haiku-4-5-20250115",
                1_000_000L, 1_000_000L);
        assertThat(cost).isEqualByComparingTo("4.80");
    }

    @Test
    void prefix_match_picks_longest_match() {
        // "claude-3-5-sonnet" doit gagner sur "claude-3-sonnet"
        BigDecimal cost = pricing.computeCost("claude-3-5-sonnet-20241022",
                1_000_000L, 1_000_000L);
        // Sonnet 3.5 = $3/$15
        assertThat(cost).isEqualByComparingTo("18.00");
    }

    @Test
    void gpt_4o_mini_pricing_correct() {
        // 1M input @ $0.15 + 1M output @ $0.60 = $0.75
        BigDecimal cost = pricing.computeCost("gpt-4o-mini", 1_000_000L, 1_000_000L);
        assertThat(cost).isEqualByComparingTo("0.75");
    }

    @Test
    void voyage_large_embedding_only_charges_input() {
        // 1M input @ $0.18 + 0 output (embeddings ne facturent que l'input)
        BigDecimal cost = pricing.computeCost("voyage-3-large", 1_000_000L, 0L);
        assertThat(cost).isEqualByComparingTo("0.18");
    }

    @Test
    void unknown_model_returns_zero_cost_silently() {
        // Robustesse : modele inconnu = $0 plutot que crash
        BigDecimal cost = pricing.computeCost("future-llm-99", 1_000_000L, 1_000_000L);
        assertThat(cost).isEqualByComparingTo("0.00");
    }

    @Test
    void null_model_returns_zero_cost() {
        BigDecimal cost = pricing.computeCost(null, 1000L, 1000L);
        assertThat(cost).isEqualByComparingTo("0.00");
    }

    @Test
    void blank_model_returns_zero_cost() {
        BigDecimal cost = pricing.computeCost("   ", 1000L, 1000L);
        assertThat(cost).isEqualByComparingTo("0.00");
    }

    @Test
    void small_token_count_produces_micro_cents() {
        // 100 in + 50 out de Sonnet 4 = 100 * 3 / 1M + 50 * 15 / 1M
        // = 0.0003 + 0.00075 = 0.001050 USD
        BigDecimal cost = pricing.computeCost("claude-sonnet-4", 100L, 50L);
        assertThat(cost).isEqualByComparingTo("0.001050");
    }

    @Test
    void price_of_known_model_returns_non_zero() {
        LlmPricingService.ModelPrice p = pricing.priceOf("claude-sonnet-4-20250514");
        assertThat(p.inputPerMillion()).isEqualByComparingTo("3.00");
        assertThat(p.outputPerMillion()).isEqualByComparingTo("15.00");
    }

    @Test
    void price_of_unknown_returns_zero_zero() {
        LlmPricingService.ModelPrice p = pricing.priceOf("totally-unknown");
        assertThat(p.inputPerMillion()).isEqualByComparingTo("0.00");
        assertThat(p.outputPerMillion()).isEqualByComparingTo("0.00");
    }
}
