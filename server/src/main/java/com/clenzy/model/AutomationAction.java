package com.clenzy.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum AutomationAction {
    SEND_MESSAGE("SEND_MESSAGE"),
    SEND_CHECKIN_LINK("SEND_CHECKIN_LINK"),
    SEND_GUIDE("SEND_GUIDE");

    private final String value;
    AutomationAction(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }
}
