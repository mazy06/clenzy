package com.clenzy.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum MessageChannelType {
    EMAIL("EMAIL"),
    WHATSAPP("WHATSAPP"),
    SMS("SMS");

    private final String value;

    MessageChannelType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }
}
