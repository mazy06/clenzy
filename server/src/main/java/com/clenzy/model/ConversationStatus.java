package com.clenzy.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum ConversationStatus {
    OPEN("OPEN"),
    CLOSED("CLOSED"),
    ARCHIVED("ARCHIVED");

    private final String value;

    ConversationStatus(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }
}
