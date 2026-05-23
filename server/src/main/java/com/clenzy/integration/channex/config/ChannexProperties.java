package com.clenzy.integration.channex.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * Configuration Channex injectee depuis {@code application.yml}.
 *
 * <pre>
 * clenzy:
 *   channex:
 *     base-url: https://staging.channex.io/api/v1
 *     api-key: ${CHANNEX_API_KEY:}
 *     webhook-secret: ${CHANNEX_WEBHOOK_SECRET:}
 *     timeout: 30s
 *     max-retries: 3
 * </pre>
 *
 * <p>L'API key et le webhook secret doivent etre charges depuis l'env (Jasypt
 * en prod). En dev/sandbox les valeurs peuvent etre laissees vides — les
 * appels au {@code ChannexClient} echoueront alors avec {@code UNAUTHORIZED}.</p>
 */
@ConfigurationProperties(prefix = "clenzy.channex")
public class ChannexProperties {

    private String baseUrl = "https://staging.channex.io/api/v1";
    private String apiKey = "";
    private String webhookSecret = "";
    private Duration timeout = Duration.ofSeconds(30);
    private int maxRetries = 3;

    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }

    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }

    public String getWebhookSecret() { return webhookSecret; }
    public void setWebhookSecret(String webhookSecret) { this.webhookSecret = webhookSecret; }

    public Duration getTimeout() { return timeout; }
    public void setTimeout(Duration timeout) { this.timeout = timeout; }

    public int getMaxRetries() { return maxRetries; }
    public void setMaxRetries(int maxRetries) { this.maxRetries = maxRetries; }

    /** True si l'API key est configuree (sandbox ou prod). */
    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }
}
