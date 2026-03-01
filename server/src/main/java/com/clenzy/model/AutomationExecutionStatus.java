package com.clenzy.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum AutomationExecutionStatus {
    PENDING("PENDING"),
    EXECUTED("EXECUTED"),
    SKIPPED("SKIPPED"),
    FAILED("FAILED");

    private final String value;
    AutomationExecutionStatus(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }
}
