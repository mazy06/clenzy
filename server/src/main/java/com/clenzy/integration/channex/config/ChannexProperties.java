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
    /**
     * Fenetre du full sync en jours. Doc Channex : 500 jours, pousses en
     * 2 appels (1 availability + 1 rates&restrictions) — test n°1 de la
     * certification PMS. Bornee cote Channex par state_length (100-730).
     */
    private int fullSyncDays = 500;
    /**
     * URL publique du controller webhook Clenzy (ex.
     * {@code https://app.clenzy.fr/api/webhooks/channex}). Vide = pas
     * d'auto-registration (dev local sans tunnel).
     */
    private String webhookCallbackUrl = "";
    /**
     * Event mask du webhook global. {@code "*"} (defaut) = tous les events —
     * les non geres retombent en "ignored" cote controller. Alternative :
     * liste separee par {@code ;} (ex. {@code "booking_new;booking_modification"}).
     */
    private String webhookEventMask = "*";
    /**
     * Base URL PUBLIQUE https du PMS (ex. {@code https://app.clenzy.fr}) —
     * utilisee pour construire les URLs de photos servies par
     * {@code /api/public/property-photos/...} que Channex re-telecharge.
     * Les octets restent dans le stockage interne (BYTEA/S3) : seule l'URL
     * d'acces est publique et STABLE (ids). Vide = photos internes non
     * poussables (dev local sans domaine public).
     */
    private String publicMediaBaseUrl = "";

    /**
     * Autorise le push ARI (availability/rates) vers Channex meme quand AUCUN
     * OTA n'est actif sur la property cote hub. DEFAUT {@code false} : en prod,
     * {@link com.clenzy.integration.channex.service.ChannexSyncService} reste
     * un no-op tant qu'aucun canal ne consomme l'ARI (economie de budget
     * rate-limit). Passe a {@code true} UNIQUEMENT en dev/staging pour la
     * certification PMS Channex, ou l'API accepte l'ARI sans canal mappe et
     * renvoie les task IDs attendus. Ne JAMAIS activer en prod.
     */
    private boolean allowPushWithoutActiveOta = false;

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

    public int getFullSyncDays() { return fullSyncDays; }
    public void setFullSyncDays(int fullSyncDays) { this.fullSyncDays = fullSyncDays; }

    public String getWebhookCallbackUrl() { return webhookCallbackUrl; }
    public void setWebhookCallbackUrl(String webhookCallbackUrl) { this.webhookCallbackUrl = webhookCallbackUrl; }

    public String getWebhookEventMask() { return webhookEventMask; }
    public void setWebhookEventMask(String webhookEventMask) { this.webhookEventMask = webhookEventMask; }

    public String getPublicMediaBaseUrl() { return publicMediaBaseUrl; }
    public void setPublicMediaBaseUrl(String publicMediaBaseUrl) { this.publicMediaBaseUrl = publicMediaBaseUrl; }

    public boolean isAllowPushWithoutActiveOta() { return allowPushWithoutActiveOta; }
    public void setAllowPushWithoutActiveOta(boolean allowPushWithoutActiveOta) { this.allowPushWithoutActiveOta = allowPushWithoutActiveOta; }

    /** True si l'API key est configuree (sandbox ou prod). */
    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }
}
