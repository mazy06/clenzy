package com.clenzy.dto;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.MessageChannelType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateAutomationRuleRequest(
    @NotBlank String name,
    @NotNull AutomationTrigger triggerType,
    int triggerOffsetDays,
    String triggerTime,
    String conditions,
    AutomationAction actionType,
    Long templateId,
    MessageChannelType deliveryChannel
) {}
