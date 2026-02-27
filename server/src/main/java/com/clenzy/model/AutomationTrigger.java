package com.clenzy.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum AutomationTrigger {
    RESERVATION_CONFIRMED("RESERVATION_CONFIRMED"),
    CHECK_IN_APPROACHING("CHECK_IN_APPROACHING"),
    CHECK_IN_DAY("CHECK_IN_DAY"),
    CHECK_OUT_DAY("CHECK_OUT_DAY"),
    CHECK_OUT_PASSED("CHECK_OUT_PASSED"),
    REVIEW_REMINDER("REVIEW_REMINDER");

    private final String value;
    AutomationTrigger(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }
}
