package com.clenzy.booking.dto;

import com.clenzy.booking.model.BookingEngineConfig;

import java.time.LocalDateTime;

/**
 * DTO admin complet pour la configuration du Booking Engine.
 * Expose tous les champs y compris l'API key et le statut.
 * Utilise par le controller admin (JWT, roles SUPER_ADMIN/SUPER_MANAGER).
 */
public record BookingEngineAdminConfigDto(
    Long id,
    Long organizationId,
    String name,
    boolean enabled,
    String apiKey,
    // Theming
    String primaryColor,
    String accentColor,
    String logoUrl,
    String fontFamily,
    // Behavior
    String defaultLanguage,
    String defaultCurrency,
    Integer minAdvanceDays,
    Integer maxAdvanceDays,
    // Policies
    String cancellationPolicy,
    String termsUrl,
    String privacyUrl,
    // Security
    String allowedOrigins,
    // Options
    boolean collectPaymentOnBooking,
    boolean autoConfirm,
    boolean showCleaningFee,
    boolean showTouristTax,
    // Custom CSS/JS + Component Config
    String customCss,
    String customJs,
    String componentConfig,
    // AI Design Analysis
    String designTokens,
    String sourceWebsiteUrl,
    LocalDateTime aiAnalysisAt,
    // Widget Integration Position
    String widgetPosition,
    String inlineTargetId,
    String inlinePlacement,
    // Cross-org (populated only for platform staff /configs/all endpoint)
    String organizationName
) {

    public static BookingEngineAdminConfigDto from(BookingEngineConfig config) {
        return from(config, null);
    }

    public static BookingEngineAdminConfigDto from(BookingEngineConfig config, String organizationName) {
        return new BookingEngineAdminConfigDto(
            config.getId(),
            config.getOrganizationId(),
            config.getName(),
            config.isEnabled(),
            config.getApiKey(),
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
            config.getAllowedOrigins(),
            config.isCollectPaymentOnBooking(),
            config.isAutoConfirm(),
            config.isShowCleaningFee(),
            config.isShowTouristTax(),
            config.getCustomCss(),
            config.getCustomJs(),
            config.getComponentConfig(),
            config.getDesignTokens(),
            config.getSourceWebsiteUrl(),
            config.getAiAnalysisAt(),
            config.getWidgetPosition(),
            config.getInlineTargetId(),
            config.getInlinePlacement(),
            organizationName
        );
    }

    /**
     * Applique les champs "settings" a l'entite.
     * Ne touche PAS id, organizationId, apiKey, enabled, name (geres par le service).
     */
    public void applyTo(BookingEngineConfig config) {
        // Note: name est gere separement par BookingEngineAdminService (validation unicite)
        config.setPrimaryColor(primaryColor);
        config.setAccentColor(accentColor);
        config.setLogoUrl(logoUrl);
        config.setFontFamily(fontFamily);
        config.setDefaultLanguage(defaultLanguage);
        config.setDefaultCurrency(defaultCurrency);
        config.setMinAdvanceDays(minAdvanceDays);
        config.setMaxAdvanceDays(maxAdvanceDays);
        config.setCancellationPolicy(cancellationPolicy);
        config.setTermsUrl(termsUrl);
        config.setPrivacyUrl(privacyUrl);
        config.setAllowedOrigins(allowedOrigins);
        config.setCollectPaymentOnBooking(collectPaymentOnBooking);
        config.setAutoConfirm(autoConfirm);
        config.setShowCleaningFee(showCleaningFee);
        config.setShowTouristTax(showTouristTax);
        config.setCustomCss(customCss);
        config.setCustomJs(customJs);
        config.setComponentConfig(componentConfig);
        config.setDesignTokens(designTokens);
        config.setSourceWebsiteUrl(sourceWebsiteUrl);
        config.setWidgetPosition(widgetPosition);
        config.setInlineTargetId(inlineTargetId);
        config.setInlinePlacement(inlinePlacement);
    }
}
