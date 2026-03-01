package com.clenzy.integration.direct.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration de l'integration Direct Booking (reservations directes via widget).
 * Toutes les valeurs sont externalisees via variables d'environnement.
 */
@Configuration
public class DirectBookingConfig {

    @Value("${direct.booking.enabled:true}")
    private boolean enabled;

    @Value("${direct.booking.widget-base-url:}")
    private String widgetBaseUrl;

    @Value("${direct.booking.stripe-enabled:true}")
    private boolean stripeEnabled;

    @Value("${direct.booking.default-currency:EUR}")
    private String defaultCurrency;

    @Value("${direct.booking.min-advance-days:1}")
    private int minAdvanceDays;

    @Value("${direct.booking.max-advance-days:365}")
    private int maxAdvanceDays;

    @Value("${direct.booking.require-payment:true}")
    private boolean requirePayment;

    @Value("${direct.booking.auto-confirm:false}")
    private boolean autoConfirm;

    // Getters

    public boolean isEnabled() {
        return enabled;
    }

    public String getWidgetBaseUrl() {
        return widgetBaseUrl;
    }

    public boolean isStripeEnabled() {
        return stripeEnabled;
    }

    public String getDefaultCurrency() {
        return defaultCurrency;
    }

    public int getMinAdvanceDays() {
        return minAdvanceDays;
    }

    public int getMaxAdvanceDays() {
        return maxAdvanceDays;
    }

    public boolean isRequirePayment() {
        return requirePayment;
    }

    public boolean isAutoConfirm() {
        return autoConfirm;
    }

    /**
     * Verifie que la configuration Direct Booking est operationnelle.
     */
    public boolean isConfigured() {
        return enabled && widgetBaseUrl != null && !widgetBaseUrl.isEmpty();
    }
}
