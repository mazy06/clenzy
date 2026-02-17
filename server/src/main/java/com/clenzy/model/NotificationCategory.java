package com.clenzy.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum NotificationCategory {
    INTERVENTION("intervention"),
    SERVICE_REQUEST("service_request"),
    PAYMENT("payment"),
    SYSTEM("system"),
    TEAM("team"),
    CONTACT("contact"),
    DOCUMENT("document");

    private final String value;

    NotificationCategory(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    public static NotificationCategory fromValue(String value) {
        for (NotificationCategory cat : values()) {
            if (cat.value.equalsIgnoreCase(value)) {
                return cat;
            }
        }
        throw new IllegalArgumentException("Unknown NotificationCategory: " + value);
    }
}
