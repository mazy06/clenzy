package com.clenzy.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests unitaires pour AiProperties — valeurs par defaut et nested objects.
 */
class AiPropertiesTest {

    @Test
    void defaultValues_areCorrect() {
        AiProperties props = new AiProperties();

        assertFalse(props.isEnabled());
        assertNotNull(props.getOpenai());
        assertNotNull(props.getAnthropic());
        assertNotNull(props.getWebsiteFetch());
        assertNotNull(props.getTokenBudget());
        assertNotNull(props.getFeatures());
    }

    @Test
    void openAi_defaultValues() {
        AiProperties.OpenAi openai = new AiProperties.OpenAi();

        assertEquals("", openai.getApiKey());
        assertEquals("gpt-4o", openai.getModel());
        assertEquals("https://api.openai.com/v1", openai.getBaseUrl());
    }

    @Test
    void anthropic_defaultValues() {
        AiProperties.Anthropic anthropic = new AiProperties.Anthropic();

        assertEquals("", anthropic.getApiKey());
        assertEquals("claude-sonnet-4-20250514", anthropic.getModel());
        assertEquals("https://api.anthropic.com/v1", anthropic.getBaseUrl());
    }

    @Test
    void websiteFetch_defaultValues() {
        AiProperties.WebsiteFetch fetch = new AiProperties.WebsiteFetch();

        assertEquals(15, fetch.getTimeoutSeconds());
        assertEquals(512, fetch.getMaxContentLengthKb());
    }

    @Test
    void tokenBudget_defaultValues() {
        AiProperties.TokenBudget budget = new AiProperties.TokenBudget();

        assertEquals(100_000, budget.getDefaultMonthlyTokens());
        assertTrue(budget.isEnforced());
    }

    @Test
    void features_allDisabledByDefault() {
        AiProperties.Features features = new AiProperties.Features();

        assertFalse(features.isPricingAi());
        assertFalse(features.isMessagingAi());
        assertFalse(features.isAnalyticsAi());
        assertFalse(features.isSentimentAi());
    }

    @Test
    void setters_work() {
        AiProperties props = new AiProperties();
        props.setEnabled(true);

        AiProperties.OpenAi openai = props.getOpenai();
        openai.setApiKey("sk-test-key");
        openai.setModel("gpt-4o-mini");
        openai.setBaseUrl("https://custom.openai.com/v1");

        AiProperties.Anthropic anthropic = props.getAnthropic();
        anthropic.setApiKey("sk-ant-test");
        anthropic.setModel("claude-3-haiku");
        anthropic.setBaseUrl("https://custom.anthropic.com/v1");

        AiProperties.TokenBudget budget = props.getTokenBudget();
        budget.setDefaultMonthlyTokens(500_000);
        budget.setEnforced(false);

        AiProperties.Features features = props.getFeatures();
        features.setPricingAi(true);
        features.setMessagingAi(true);
        features.setAnalyticsAi(true);
        features.setSentimentAi(true);

        assertTrue(props.isEnabled());
        assertEquals("sk-test-key", openai.getApiKey());
        assertEquals("gpt-4o-mini", openai.getModel());
        assertEquals("https://custom.openai.com/v1", openai.getBaseUrl());
        assertEquals("sk-ant-test", anthropic.getApiKey());
        assertEquals("claude-3-haiku", anthropic.getModel());
        assertEquals(500_000, budget.getDefaultMonthlyTokens());
        assertFalse(budget.isEnforced());
        assertTrue(features.isPricingAi());
        assertTrue(features.isMessagingAi());
        assertTrue(features.isAnalyticsAi());
        assertTrue(features.isSentimentAi());
    }
}
