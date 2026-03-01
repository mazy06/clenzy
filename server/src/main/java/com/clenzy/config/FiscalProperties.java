package com.clenzy.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Proprietes de configuration du module fiscal multi-pays.
 *
 * Usage dans application.yml :
 *   fiscal:
 *     multi-country:
 *       enabled: false
 *
 * Le feature flag permet d'activer progressivement le support multi-pays
 * sans impacter les clients existants (France uniquement).
 */
@Component
@ConfigurationProperties(prefix = "fiscal.multi-country")
public class FiscalProperties {

    private boolean enabled = false;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }
}
