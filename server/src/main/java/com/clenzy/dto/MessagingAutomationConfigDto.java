package com.clenzy.dto;

import com.clenzy.model.MessagingAutomationConfig;

public record MessagingAutomationConfigDto(
    boolean autoSendCheckIn,
    boolean autoSendCheckOut,
    int hoursBeforeCheckIn,
    int hoursBeforeCheckOut,
    Long checkInTemplateId,
    Long checkOutTemplateId,
    boolean autoPushPricingEnabled
) {
    public static MessagingAutomationConfigDto fromEntity(MessagingAutomationConfig e) {
        return new MessagingAutomationConfigDto(
            e.isAutoSendCheckIn(),
            e.isAutoSendCheckOut(),
            e.getHoursBeforeCheckIn(),
            e.getHoursBeforeCheckOut(),
            e.getCheckInTemplateId(),
            e.getCheckOutTemplateId(),
            e.isAutoPushPricingEnabled()
        );
    }
}
