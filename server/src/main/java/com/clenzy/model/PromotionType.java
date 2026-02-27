package com.clenzy.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum PromotionType {
    GENIUS("genius"),
    PREFERRED_PARTNER("preferred_partner"),
    VISIBILITY_BOOSTER("visibility_booster"),
    MOBILE_RATE("mobile_rate"),
    COUNTRY_RATE("country_rate"),
    EARLY_BIRD_OTA("early_bird_ota"),
    FLASH_SALE("flash_sale"),
    LONG_STAY_OTA("long_stay_ota");

    private final String value;

    PromotionType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }
}
