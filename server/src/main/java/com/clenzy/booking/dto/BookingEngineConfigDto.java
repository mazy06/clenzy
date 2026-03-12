package com.clenzy.booking.dto;

import com.clenzy.booking.model.BookingEngineConfig;

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
    String componentConfig
) {
    public static BookingEngineConfigDto from(BookingEngineConfig config) {
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
            config.getComponentConfig()
        );
    }
}
