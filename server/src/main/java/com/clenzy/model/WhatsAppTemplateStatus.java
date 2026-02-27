package com.clenzy.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum WhatsAppTemplateStatus {
    APPROVED("APPROVED"),
    PENDING("PENDING"),
    REJECTED("REJECTED");

    private final String value;
    WhatsAppTemplateStatus(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }
}
