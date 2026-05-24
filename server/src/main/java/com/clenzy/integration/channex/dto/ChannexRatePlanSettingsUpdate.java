package com.clenzy.integration.channex.dto;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Settings d'un rate_plan a pousser vers Channex via PUT /rate_plans/{id} —
 * Phase 5 OTA pricing (push complet bidirectionnel).
 *
 * <p>Tous les champs sont nullable : seuls ceux non-null seront inclus dans le
 * payload JSON envoye a Channex (partial update). Cela permet a chaque caller
 * de ne push QUE ce qu'il veut modifier (ex : juste {@code weekendPrice}).</p>
 *
 * <p>Le builder {@link #toApiPayload()} construit la structure attendue par
 * Channex : {@code {"rate_plan": {"settings": {...}}}}.</p>
 */
public record ChannexRatePlanSettingsUpdate(
    // pricing_setting
    BigDecimal defaultDailyPrice,
    BigDecimal weekendPrice,
    Integer guestsIncluded,
    BigDecimal pricePerExtraPerson,
    Double weeklyPriceFactor,
    Double monthlyPriceFactor,

    // availability_rule
    Integer defaultMinNights,
    Integer defaultMaxNights
) {

    /**
     * Construit le payload Channex {@code {"rate_plan": {"settings": {...}}}}
     * en n'incluant que les champs non-null (partial update).
     */
    public Map<String, Object> toApiPayload() {
        Map<String, Object> pricing = new LinkedHashMap<>();
        if (defaultDailyPrice != null) pricing.put("default_daily_price", defaultDailyPrice.toPlainString());
        if (weekendPrice != null) pricing.put("weekend_price", weekendPrice.toPlainString());
        if (guestsIncluded != null) pricing.put("guests_included", guestsIncluded);
        if (pricePerExtraPerson != null) pricing.put("price_per_extra_person", pricePerExtraPerson.toPlainString());
        if (weeklyPriceFactor != null) pricing.put("weekly_price_factor", weeklyPriceFactor);
        if (monthlyPriceFactor != null) pricing.put("monthly_price_factor", monthlyPriceFactor);

        Map<String, Object> availability = new LinkedHashMap<>();
        if (defaultMinNights != null) availability.put("default_min_nights", defaultMinNights);
        if (defaultMaxNights != null) availability.put("default_max_nights", defaultMaxNights);

        Map<String, Object> settings = new LinkedHashMap<>();
        if (!pricing.isEmpty()) settings.put("pricing_setting", pricing);
        if (!availability.isEmpty()) settings.put("availability_rule", availability);

        Map<String, Object> ratePlan = new LinkedHashMap<>();
        ratePlan.put("settings", settings);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("rate_plan", ratePlan);
        return body;
    }

    /** True si au moins un champ est renseigne (sinon le payload est vide → no-op). */
    public boolean hasContent() {
        return defaultDailyPrice != null || weekendPrice != null || guestsIncluded != null
            || pricePerExtraPerson != null || weeklyPriceFactor != null
            || monthlyPriceFactor != null || defaultMinNights != null
            || defaultMaxNights != null;
    }
}
