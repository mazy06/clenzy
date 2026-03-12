package com.clenzy.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Proprietes de configuration du module AI.
 *
 * Usage dans application.yml :
 *   clenzy:
 *     ai:
 *       enabled: false
 *       openai:
 *         api-key: ${OPENAI_API_KEY:}
 *         model: gpt-4o
 *       anthropic:
 *         api-key: ${ANTHROPIC_API_KEY:}
 *         model: claude-sonnet-4-20250514
 *       token-budget:
 *         default-monthly-tokens: 100000
 *         enforced: true
 *       features:
 *         pricing-ai: false
 *         messaging-ai: false
 *         analytics-ai: false
 *         sentiment-ai: false
 *
 * Chaque feature AI est independamment activable via son flag.
 * Le flag global "enabled" doit etre true pour que les providers LLM fonctionnent.
 */
@Component
@ConfigurationProperties(prefix = "clenzy.ai")
public class AiProperties {

    private boolean enabled = false;
    private OpenAi openai = new OpenAi();
    private Anthropic anthropic = new Anthropic();
    private WebsiteFetch websiteFetch = new WebsiteFetch();
    private TokenBudget tokenBudget = new TokenBudget();
    private Features features = new Features();

    // ─── OpenAI ──────────────────────────────────────────────────────────

    public static class OpenAi {
        private String apiKey = "";
        private String model = "gpt-4o";
        private String baseUrl = "https://api.openai.com/v1";

        public String getApiKey() { return apiKey; }
        public void setApiKey(String apiKey) { this.apiKey = apiKey; }
        public String getModel() { return model; }
        public void setModel(String model) { this.model = model; }
        public String getBaseUrl() { return baseUrl; }
        public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
    }

    // ─── Anthropic ───────────────────────────────────────────────────────

    public static class Anthropic {
        private String apiKey = "";
        private String model = "claude-sonnet-4-20250514";
        private String baseUrl = "https://api.anthropic.com/v1";

        public String getApiKey() { return apiKey; }
        public void setApiKey(String apiKey) { this.apiKey = apiKey; }
        public String getModel() { return model; }
        public void setModel(String model) { this.model = model; }
        public String getBaseUrl() { return baseUrl; }
        public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
    }

    // ─── Website Fetch (design analysis) ─────────────────────────────────

    public static class WebsiteFetch {
        private int timeoutSeconds = 15;
        private int maxContentLengthKb = 512;

        public int getTimeoutSeconds() { return timeoutSeconds; }
        public void setTimeoutSeconds(int timeoutSeconds) { this.timeoutSeconds = timeoutSeconds; }
        public int getMaxContentLengthKb() { return maxContentLengthKb; }
        public void setMaxContentLengthKb(int maxContentLengthKb) { this.maxContentLengthKb = maxContentLengthKb; }
    }

    // ─── Token Budget ────────────────────────────────────────────────────

    public static class TokenBudget {
        private long defaultMonthlyTokens = 100_000;
        private boolean enforced = true;

        public long getDefaultMonthlyTokens() { return defaultMonthlyTokens; }
        public void setDefaultMonthlyTokens(long defaultMonthlyTokens) { this.defaultMonthlyTokens = defaultMonthlyTokens; }
        public boolean isEnforced() { return enforced; }
        public void setEnforced(boolean enforced) { this.enforced = enforced; }
    }

    // ─── Feature Flags (chaque feature AI independamment activable) ──────

    public static class Features {
        private boolean pricingAi = false;
        private boolean messagingAi = false;
        private boolean analyticsAi = false;
        private boolean sentimentAi = false;

        public boolean isPricingAi() { return pricingAi; }
        public void setPricingAi(boolean pricingAi) { this.pricingAi = pricingAi; }
        public boolean isMessagingAi() { return messagingAi; }
        public void setMessagingAi(boolean messagingAi) { this.messagingAi = messagingAi; }
        public boolean isAnalyticsAi() { return analyticsAi; }
        public void setAnalyticsAi(boolean analyticsAi) { this.analyticsAi = analyticsAi; }
        public boolean isSentimentAi() { return sentimentAi; }
        public void setSentimentAi(boolean sentimentAi) { this.sentimentAi = sentimentAi; }
    }

    // ─── Root getters/setters ────────────────────────────────────────────

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public OpenAi getOpenai() { return openai; }
    public void setOpenai(OpenAi openai) { this.openai = openai; }

    public Anthropic getAnthropic() { return anthropic; }
    public void setAnthropic(Anthropic anthropic) { this.anthropic = anthropic; }

    public WebsiteFetch getWebsiteFetch() { return websiteFetch; }
    public void setWebsiteFetch(WebsiteFetch websiteFetch) { this.websiteFetch = websiteFetch; }

    public TokenBudget getTokenBudget() { return tokenBudget; }
    public void setTokenBudget(TokenBudget tokenBudget) { this.tokenBudget = tokenBudget; }

    public Features getFeatures() { return features; }
    public void setFeatures(Features features) { this.features = features; }
}
