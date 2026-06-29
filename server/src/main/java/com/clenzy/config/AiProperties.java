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
 *
 * L'activation par feature est gouvernee par la config DB (toggle AiTokenBudget.enabled),
 * source de verite unique — cf. AiTokenBudgetService.requireFeatureEnabled.
 * Le flag global "enabled" doit etre true pour que les providers LLM fonctionnent.
 */
@Component
@ConfigurationProperties(prefix = "clenzy.ai")
public class AiProperties {

    private boolean enabled = false;
    private OpenAi openai = new OpenAi();
    private Anthropic anthropic = new Anthropic();
    private Bedrock bedrock = new Bedrock();
    private WebsiteFetch websiteFetch = new WebsiteFetch();
    private TokenBudget tokenBudget = new TokenBudget();

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

    // ─── Bedrock (provider gratuit par defaut) ─────────────────────────────

    public static class Bedrock {
        private boolean enabled = true;
        private String apiKey = "";
        private String model = "amazon.nova-lite-v1:0";
        private String baseUrl = "https://bedrock-mantle.eu-west-1.api.aws/v1";

        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
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

    // ─── Root getters/setters ────────────────────────────────────────────

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public OpenAi getOpenai() { return openai; }
    public void setOpenai(OpenAi openai) { this.openai = openai; }

    public Anthropic getAnthropic() { return anthropic; }
    public void setAnthropic(Anthropic anthropic) { this.anthropic = anthropic; }

    public Bedrock getBedrock() { return bedrock; }
    public void setBedrock(Bedrock bedrock) { this.bedrock = bedrock; }

    public WebsiteFetch getWebsiteFetch() { return websiteFetch; }
    public void setWebsiteFetch(WebsiteFetch websiteFetch) { this.websiteFetch = websiteFetch; }

    public TokenBudget getTokenBudget() { return tokenBudget; }
    public void setTokenBudget(TokenBudget tokenBudget) { this.tokenBudget = tokenBudget; }

}
