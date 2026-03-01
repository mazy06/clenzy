package com.clenzy.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum ReviewTag {
    CLEANLINESS("CLEANLINESS"),
    LOCATION("LOCATION"),
    VALUE("VALUE"),
    COMMUNICATION("COMMUNICATION"),
    CHECK_IN("CHECK_IN"),
    COMFORT("COMFORT"),
    ACCURACY("ACCURACY"),
    AMENITIES("AMENITIES");

    private final String value;

    ReviewTag(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }
}
