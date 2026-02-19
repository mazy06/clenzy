package com.clenzy.integration.tuya.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class TuyaConfig {

    @Value("${tuya.api.base-url:https://openapi.tuyaeu.com}")
    private String apiBaseUrl;

    @Value("${tuya.api.region:eu}")
    private String region;

    @Value("${tuya.auth.access-id:}")
    private String accessId;

    @Value("${tuya.auth.access-secret:}")
    private String accessSecret;

    // ─── Getters ────────────────────────────────────────────────

    public String getApiBaseUrl() { return apiBaseUrl; }
    public String getRegion() { return region; }
    public String getAccessId() { return accessId; }
    public String getAccessSecret() { return accessSecret; }

    public boolean isConfigured() {
        return accessId != null && !accessId.isEmpty()
                && accessSecret != null && !accessSecret.isEmpty();
    }
}
