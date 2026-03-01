package com.clenzy.integration.direct.service;

import com.clenzy.integration.direct.config.DirectBookingConfig;
import com.clenzy.integration.direct.model.DirectBookingConfiguration;
import com.clenzy.integration.direct.repository.DirectBookingConfigRepository;
import com.clenzy.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

/**
 * Service de gestion du widget de reservation directe.
 * Fournit la configuration du widget et le code d'integration.
 */
@Service
@Transactional(readOnly = true)
public class DirectBookingWidgetService {

    private static final Logger log = LoggerFactory.getLogger(DirectBookingWidgetService.class);

    private final DirectBookingConfig config;
    private final DirectBookingConfigRepository configRepository;

    public DirectBookingWidgetService(DirectBookingConfig config,
                                       DirectBookingConfigRepository configRepository) {
        this.config = config;
        this.configRepository = configRepository;
    }

    /**
     * Retourne la configuration du widget pour une propriete donnee.
     * Utilisee par l'administration pour previsualiser le widget.
     */
    public Map<String, Object> getWidgetConfig(Long propertyId, Long orgId) {
        DirectBookingConfiguration dbConfig = configRepository
                .findByPropertyIdAndOrganizationId(propertyId, orgId)
                .orElse(null);

        Map<String, Object> widgetConfig = new HashMap<>();
        widgetConfig.put("propertyId", propertyId);
        widgetConfig.put("widgetBaseUrl", config.getWidgetBaseUrl());
        widgetConfig.put("currency", config.getDefaultCurrency());
        widgetConfig.put("stripeEnabled", config.isStripeEnabled());
        widgetConfig.put("minAdvanceDays", config.getMinAdvanceDays());
        widgetConfig.put("maxAdvanceDays", config.getMaxAdvanceDays());

        if (dbConfig != null) {
            widgetConfig.put("enabled", dbConfig.isEnabled());
            widgetConfig.put("themeColor", dbConfig.getWidgetThemeColor());
            widgetConfig.put("logo", dbConfig.getWidgetLogo());
            widgetConfig.put("customCss", dbConfig.getCustomCss());
            widgetConfig.put("termsUrl", dbConfig.getTermsAndConditionsUrl());
            widgetConfig.put("cancellationPolicy", dbConfig.getCancellationPolicyText());
            widgetConfig.put("autoConfirm", dbConfig.isAutoConfirm());
            widgetConfig.put("requirePayment", dbConfig.isRequirePayment());
            widgetConfig.put("allowedCurrencies", dbConfig.getAllowedCurrencies());
        } else {
            widgetConfig.put("enabled", false);
            widgetConfig.put("autoConfirm", config.isAutoConfirm());
            widgetConfig.put("requirePayment", config.isRequirePayment());
        }

        return widgetConfig;
    }

    /**
     * Genere le code d'integration (iframe + script) pour embarquer le widget
     * sur le site web du proprietaire.
     *
     * Le propertyId est echappe pour prevenir les injections XSS.
     */
    public String getEmbedCode(Long propertyId, Long orgId) {
        DirectBookingConfiguration dbConfig = configRepository
                .findByPropertyIdAndOrganizationId(propertyId, orgId)
                .orElse(null);

        if (dbConfig == null || !dbConfig.isEnabled()) {
            log.warn("getEmbedCode: direct booking non active pour propriete {} org {}", propertyId, orgId);
            return "<!-- Direct booking non active pour cette propriete -->";
        }

        String baseUrl = config.getWidgetBaseUrl();
        String escapedPropertyId = StringUtils.escapeHtml(String.valueOf(propertyId));
        String themeColor = dbConfig.getWidgetThemeColor() != null
                ? StringUtils.escapeHtml(dbConfig.getWidgetThemeColor())
                : "#2563EB";

        return """
                <!-- Clenzy Direct Booking Widget -->
                <div id="clenzy-booking-widget" data-property-id="%s" data-theme-color="%s"></div>
                <script src="%s/widget.js" async></script>
                <!-- Fin Clenzy Direct Booking Widget -->
                """.formatted(escapedPropertyId, themeColor, baseUrl);
    }
}
