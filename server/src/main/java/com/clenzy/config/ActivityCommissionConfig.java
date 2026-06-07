package com.clenzy.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.math.BigDecimal;

/**
 * Répartition de la commission d'affiliation sur les activités (Clenzy = affilié
 * officiel ; reverse la part hôte). {@code hostSharePct} = part hôte en % ; la
 * plateforme garde le complément.
 */
@Configuration
@ConfigurationProperties(prefix = "clenzy.activity-commission")
public class ActivityCommissionConfig {

    /** Part hôte en pourcentage (70 = 70% hôte / 30% plateforme). Réglable par env. */
    private BigDecimal hostSharePct = new BigDecimal("70");

    public BigDecimal getHostSharePct() { return hostSharePct; }
    public void setHostSharePct(BigDecimal hostSharePct) { this.hostSharePct = hostSharePct; }
}
