package com.clenzy.integration.zapier.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration pour le systeme de webhooks (Zapier et autres).
 */
@Configuration
@ConfigurationProperties(prefix = "clenzy.webhooks")
public class ZapierConfig {

    private boolean enabled = true;
    private int maxSubscriptionsPerOrg = 20;
    private int retryAttempts = 3;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public int getMaxSubscriptionsPerOrg() {
        return maxSubscriptionsPerOrg;
    }

    public void setMaxSubscriptionsPerOrg(int maxSubscriptionsPerOrg) {
        this.maxSubscriptionsPerOrg = maxSubscriptionsPerOrg;
    }

    public int getRetryAttempts() {
        return retryAttempts;
    }

    public void setRetryAttempts(int retryAttempts) {
        this.retryAttempts = retryAttempts;
    }
}
