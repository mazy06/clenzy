package com.clenzy.booking.dto;

import com.clenzy.booking.model.BookingEngineConfig;

import java.math.BigDecimal;

/**
 * Configuration publique du Booking Engine.
 * Expose uniquement les infos utiles a l'integrateur (pas d'API key, pas d'ID interne).
 */
public record BookingEngineConfigDto(
    String primaryColor,
    String accentColor,
    String logoUrl,
    String fontFamily,
    String defaultLanguage,
    String defaultCurrency,
    Integer minAdvanceDays,
    Integer maxAdvanceDays,
    String cancellationPolicy,
    String termsUrl,
    String privacyUrl,
    boolean collectPaymentOnBooking,
    boolean showCleaningFee,
    boolean showTouristTax,
    String customCss,
    String customJs,
    String componentConfig,
    // Page composée par blocs (builder) — rendue par la page publique hébergée.
    String pageLayout,
    // Design tokens (JSON, 21 props : rayon, ombres, surfaces, typo…) — appliqués au widget + blocs.
    String designTokens,
    // Caution pré-autorisée sur la carte (affichage voyageur ; NULL = aucune).
    BigDecimal securityDepositAmount,
    // Acompte : % prélevé à la réservation (NULL = intégral) + délai du solde (affichage voyageur).
    Integer depositPercent,
    Integer balanceDueDays,
    // Capture de leads activée au niveau org (2.12) — pilote l'affichage du form exit-intent du widget.
    boolean leadCaptureEnabled
) {
    public static BookingEngineConfigDto from(BookingEngineConfig config) {
        return from(config, true);
    }

    public static BookingEngineConfigDto from(BookingEngineConfig config, boolean leadCaptureEnabled) {
        return new BookingEngineConfigDto(
            config.getPrimaryColor(),
            config.getAccentColor(),
            config.getLogoUrl(),
            config.getFontFamily(),
            config.getDefaultLanguage(),
            config.getDefaultCurrency(),
            config.getMinAdvanceDays(),
            config.getMaxAdvanceDays(),
            config.getCancellationPolicy(),
            config.getTermsUrl(),
            config.getPrivacyUrl(),
            config.isCollectPaymentOnBooking(),
            config.isShowCleaningFee(),
            config.isShowTouristTax(),
            config.getCustomCss(),
            config.getCustomJs(),
            config.getComponentConfig(),
            config.getPageLayout(),
            config.getDesignTokens(),
            config.getSecurityDepositAmount(),
            config.getDepositPercent(),
            config.getBalanceDueDays(),
            leadCaptureEnabled
        );
    }
}
