package com.clenzy.dto;

import com.clenzy.model.WebhookConfig;
import com.clenzy.model.WebhookConfig.WebhookStatus;

import java.time.Instant;
import java.util.List;

public record WebhookConfigDto(
    Long id,
    String url,
    List<String> events,
    WebhookStatus status,
    Integer failureCount,
    Instant lastTriggeredAt,
    Instant createdAt
) {
    public static WebhookConfigDto from(WebhookConfig w) {
        List<String> eventList = w.getEvents() != null ?
            List.of(w.getEvents().split(",")) : List.of();
        return new WebhookConfigDto(
            w.getId(), w.getUrl(), eventList,
            w.getStatus(), w.getFailureCount(),
            w.getLastTriggeredAt(), w.getCreatedAt()
        );
    }
}
