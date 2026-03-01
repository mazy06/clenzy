package com.clenzy.dto;

import com.clenzy.model.*;
import java.time.LocalDateTime;

public record AutomationRuleDto(
    Long id,
    String name,
    boolean enabled,
    int sortOrder,
    AutomationTrigger triggerType,
    int triggerOffsetDays,
    String triggerTime,
    String conditions,
    AutomationAction actionType,
    Long templateId,
    String templateName,
    MessageChannelType deliveryChannel,
    LocalDateTime createdAt
) {
    public static AutomationRuleDto from(AutomationRule r) {
        return new AutomationRuleDto(
            r.getId(), r.getName(), r.isEnabled(), r.getSortOrder(),
            r.getTriggerType(), r.getTriggerOffsetDays(), r.getTriggerTime(),
            r.getConditions(), r.getActionType(),
            r.getTemplate() != null ? r.getTemplate().getId() : null,
            r.getTemplate() != null ? r.getTemplate().getName() : null,
            r.getDeliveryChannel(), r.getCreatedAt()
        );
    }
}
