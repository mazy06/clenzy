package com.clenzy.integration.channex.dto;

/**
 * Property du hub de distribution detectee via discovery (importee ou non).
 *
 * <p>Renvoyee par {@code GET /api/integrations/channex/discover}. Permet a
 * l'utilisateur de voir TOUTES ses proprietes du hub et de choisir lesquelles
 * importer (cocher) ou desimporter (decocher) via checkboxes inversibles dans
 * le modal Distribution.</p>
 *
 * @param channexPropertyId  UUID Channex (sera stocke dans le mapping local)
 * @param title              nom affiche cote hub (ex: "Studio Marais")
 * @param currency           devise (ex: "EUR")
 * @param country            code pays ISO 2 (ex: "FR")
 * @param timezone           ex: "Europe/Paris"
 * @param maxOccupancy       capacite max detectee (depuis room_type, peut etre null)
 * @param suggestedType      type Clenzy suggere ("APARTMENT", "HOUSE", "STUDIO")
 * @param hasActiveOta       true si au moins un OTA est branche sur cette property
 * @param hasRoomType        true si la property a deja au moins un room_type
 * @param hasRatePlan        true si la property a deja au moins un rate_plan
 * @param photoCount         Nombre de photos disponibles cote hub
 * @param hasDescription     True si content.description non-vide
 * @param hasAddress         True si address non-vide
 * @param isImported         True si cette property est deja mappee a une Property Clenzy
 * @param clenzyPropertyId   ID de la Property Clenzy si {@code isImported}, null sinon
 * @param clenzyPropertyName Nom de la Property Clenzy si {@code isImported}, null sinon
 * @param connectedOtas      OTAs synchronises sur cette property (vide si aucun OAuth)
 * @param otaListingType         Type listing brut OTA (Airbnb: "house", "apartment"...)
 * @param otaNightlyPrice        rate_plan.pricing_setting.default_daily_price
 * @param otaWeekendPrice        rate_plan.pricing_setting.weekend_price
 * @param otaGuestsIncluded      rate_plan.pricing_setting.guests_included (BASE, pas max)
 * @param otaPricePerExtraPerson rate_plan.pricing_setting.price_per_extra_person
 * @param otaWeeklyPriceFactor   rate_plan.pricing_setting.weekly_price_factor (0 = pas de remise)
 * @param otaMonthlyPriceFactor  rate_plan.pricing_setting.monthly_price_factor (16 = 16% de remise)
 * @param otaMinNights           rate_plan.availability_rule.default_min_nights
 * @param otaMaxNights           rate_plan.availability_rule.default_max_nights
 * @param otaCheckInTimeStart    rate_plan.booking_setting.check_in_time_start ("FLEXIBLE" ou "14")
 * @param otaCheckInTimeEnd      rate_plan.booking_setting.check_in_time_end
 * @param otaCheckOutTime        rate_plan.booking_setting.check_out_time (heure ex: 11)
 * @param otaCancellationPolicy  rate_plan.booking_setting.cancellation_policy_settings.cancellation_policy_category
 * @param otaInstantBooking      rate_plan.booking_setting.instant_booking_allowed_category ("everyone")
 * @param otaAllowsPets          guest_controls.allows_pets_as_host
 * @param otaAllowsSmoking       guest_controls.allows_smoking_as_host
 * @param otaAllowsEvents        guest_controls.allows_events_as_host
 */
public record ChannexDiscoveredProperty(
    String channexPropertyId,
    String title,
    String currency,
    String country,
    String timezone,
    Integer maxOccupancy,
    String suggestedType,
    boolean hasActiveOta,
    boolean hasRoomType,
    boolean hasRatePlan,
    int photoCount,
    boolean hasDescription,
    boolean hasAddress,
    boolean isImported,
    Long clenzyPropertyId,
    String clenzyPropertyName,
    java.util.List<ChannexPropertyOtaSync> connectedOtas,
    // ── Donnees structurees OTA (toutes depuis rate_plan settings — pas de scraping)
    String otaListingType,
    java.math.BigDecimal otaNightlyPrice,
    java.math.BigDecimal otaWeekendPrice,
    Integer otaGuestsIncluded,
    java.math.BigDecimal otaPricePerExtraPerson,
    Double otaWeeklyPriceFactor,
    Double otaMonthlyPriceFactor,
    Integer otaMinNights,
    Integer otaMaxNights,
    String otaCheckInTimeStart,
    String otaCheckInTimeEnd,
    Integer otaCheckOutTime,
    String otaCancellationPolicy,
    String otaInstantBooking,
    Boolean otaAllowsPets,
    Boolean otaAllowsSmoking,
    Boolean otaAllowsEvents
) {}
