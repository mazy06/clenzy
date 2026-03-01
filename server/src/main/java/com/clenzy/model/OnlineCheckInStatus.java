package com.clenzy.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum OnlineCheckInStatus {
    PENDING("PENDING"),
    STARTED("STARTED"),
    COMPLETED("COMPLETED"),
    EXPIRED("EXPIRED");

    private final String value;
    OnlineCheckInStatus(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }
}
