package com.clenzy.integration.docuseal;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration de l'instance DocuSeal auto-hébergée (clenzy-infra).
 *
 * <p>DocuSeal est un service partagé de la plateforme (un container Docker dans
 * clenzy-infra), pas une connexion per-org : la configuration est donc globale,
 * par variables d'environnement. Tant que {@code baseUrl} et {@code apiKey} sont
 * vides, le provider est indisponible et le workflow interne reste utilisé.</p>
 *
 * <pre>
 * clenzy:
 *   signature:
 *     docuseal:
 *       base-url: ${DOCUSEAL_BASE_URL:}   # ex. https://sign.clenzy.fr
 *       api-key:  ${DOCUSEAL_API_KEY:}    # X-Auth-Token (réglages DocuSeal → API)
 * </pre>
 */
@Configuration
@ConfigurationProperties(prefix = "clenzy.signature.docuseal")
public class DocuSealConfig {

    /** URL de l'instance self-hosted (vide = non déployée → provider indisponible). */
    private String baseUrl = "";

    /** Clé API DocuSeal (header X-Auth-Token). */
    private String apiKey = "";

    public boolean isConfigured() {
        return baseUrl != null && !baseUrl.isBlank() && apiKey != null && !apiKey.isBlank();
    }

    /** Base URL sans slash final. */
    public String normalizedBaseUrl() {
        return baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
}
