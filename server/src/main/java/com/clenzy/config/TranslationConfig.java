package com.clenzy.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration pour le service de traduction automatique.
 * Supporte DeepL et Google Translate.
 */
@Configuration
@ConfigurationProperties(prefix = "clenzy.translation")
public class TranslationConfig {

    private boolean enabled = false;
    private String provider = "deepl"; // "deepl" or "google"
    private String deeplApiKey;
    private String deeplApiUrl = "https://api-free.deepl.com/v2/translate";
    private String googleApiKey;
    private int cacheTtlHours = 24;

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public String getDeeplApiKey() { return deeplApiKey; }
    public void setDeeplApiKey(String deeplApiKey) { this.deeplApiKey = deeplApiKey; }

    public String getDeeplApiUrl() { return deeplApiUrl; }
    public void setDeeplApiUrl(String deeplApiUrl) { this.deeplApiUrl = deeplApiUrl; }

    public String getGoogleApiKey() { return googleApiKey; }
    public void setGoogleApiKey(String googleApiKey) { this.googleApiKey = googleApiKey; }

    public int getCacheTtlHours() { return cacheTtlHours; }
    public void setCacheTtlHours(int cacheTtlHours) { this.cacheTtlHours = cacheTtlHours; }
}
