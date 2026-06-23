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
    // Book Direct & Save (2.8) — remise % réservation directe (affichage de l'économie côté widget).
    Integer directBookingDiscountPercent,
    // Tarif membre (2.8) — remise % voyageur connecté (le widget incite à se connecter / affiche l'éco).
    Integer memberDiscountPercent,
    // Capture de leads activée au niveau org (2.12) — gate l'endpoint /leads (acceptation serveur).
    boolean leadCaptureEnabled,
    // Popup exit-intent activé au niveau org (opt-in) — pilote l'affichage du popup dans le widget.
    boolean leadCapturePopupEnabled,
    // Contenu publié de la page HOME du site rattaché à cette config (enveloppe GrapesJS ou blocs legacy).
    // NULL = aucun site publié / pas de page HOME → la SPA publique retombe sur un état vide (page bookable
    // via la section #reserver). Résolu côté service (PublicBookingService.getConfig), pas porté par la config.
    String homePageBlocks
) {
    public static BookingEngineConfigDto from(BookingEngineConfig config) {
        return from(config, true, false, null);
    }

    public static BookingEngineConfigDto from(BookingEngineConfig config, boolean leadCaptureEnabled, boolean leadCapturePopupEnabled) {
        return from(config, leadCaptureEnabled, leadCapturePopupEnabled, null);
    }

    public static BookingEngineConfigDto from(BookingEngineConfig config, boolean leadCaptureEnabled,
                                              boolean leadCapturePopupEnabled, String homePageBlocks) {
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
            config.getDirectBookingDiscountPercent(),
            config.getMemberDiscountPercent(),
            leadCaptureEnabled,
            leadCapturePopupEnabled,
            homePageBlocks
        );
    }
}
