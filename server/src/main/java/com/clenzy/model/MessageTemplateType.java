package com.clenzy.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum MessageTemplateType {
    CHECK_IN("CHECK_IN"),
    CHECK_OUT("CHECK_OUT"),
    WELCOME("WELCOME"),
    CUSTOM("CUSTOM"),
    NOISE_ALERT("NOISE_ALERT");

    private final String value;

    MessageTemplateType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }
}
