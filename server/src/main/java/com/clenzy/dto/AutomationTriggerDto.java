package com.clenzy.dto;

import com.clenzy.model.ExternalAutomation;
import com.clenzy.model.ExternalAutomation.AutomationEvent;
import com.clenzy.model.ExternalAutomation.AutomationPlatform;

import java.time.Instant;

public record AutomationTriggerDto(
    Long id,
    String triggerName,
    AutomationPlatform platform,
    AutomationEvent triggerEvent,
    String callbackUrl,
    Boolean isActive,
    Instant lastTriggeredAt,
    Long triggerCount,
    Instant createdAt
) {
    public static AutomationTriggerDto from(ExternalAutomation t) {
        return new AutomationTriggerDto(
            t.getId(), t.getTriggerName(), t.getPlatform(),
            t.getTriggerEvent(), t.getCallbackUrl(), t.getIsActive(),
            t.getLastTriggeredAt(), t.getTriggerCount(), t.getCreatedAt()
        );
    }
}
