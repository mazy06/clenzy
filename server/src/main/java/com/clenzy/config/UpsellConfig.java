package com.clenzy.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.math.BigDecimal;

/**
 * Paramétrage des upsells payants du livret.
 *
 * <p>{@code platformFeePct} = part (%) prélevée par la plateforme sur chaque upsell
 * payé ; le reste est crédité à l'hôte via le ledger interne puis versé par le payout.</p>
 */
@Configuration
@ConfigurationProperties(prefix = "clenzy.upsell")
public class UpsellConfig {

    /** Part plateforme en pourcentage (10 = 10%). Réglable par env / config. */
    private BigDecimal platformFeePct = new BigDecimal("10");

    public BigDecimal getPlatformFeePct() { return platformFeePct; }
    public void setPlatformFeePct(BigDecimal platformFeePct) { this.platformFeePct = platformFeePct; }
}
