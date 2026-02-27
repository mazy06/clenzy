package com.clenzy.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum ConversationChannel {
    AIRBNB("AIRBNB"),
    BOOKING("BOOKING"),
    WHATSAPP("WHATSAPP"),
    EMAIL("EMAIL"),
    SMS("SMS"),
    INTERNAL("INTERNAL");

    private final String value;

    ConversationChannel(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }
}
