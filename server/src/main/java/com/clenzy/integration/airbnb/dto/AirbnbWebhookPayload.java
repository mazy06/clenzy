package com.clenzy.integration.airbnb.dto;

import java.util.HashMap;
import java.util.Map;

/**
 * DTO for incoming Airbnb webhook payloads.
 */
public class AirbnbWebhookPayload {

    private String eventId;
    private String eventType;
    private String timestamp;
    private Map<String, Object> data = new HashMap<>();

    public AirbnbWebhookPayload() {
    }

    public String getEventId() {
        return eventId;
    }

    public void setEventId(String eventId) {
        this.eventId = eventId;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public Map<String, Object> getData() {
        return data;
    }

    public void setData(Map<String, Object> data) {
        this.data = data;
    }
}
