package com.clenzy.dto;

import com.clenzy.model.PayoutScheduleConfig;

import java.time.Instant;
import java.util.List;

public record PayoutScheduleConfigDto(
    Long id,
    List<Integer> payoutDaysOfMonth,
    int gracePeriodDays,
    boolean autoGenerateEnabled,
    Instant updatedAt
) {
    public static PayoutScheduleConfigDto from(PayoutScheduleConfig config) {
        return new PayoutScheduleConfigDto(
            config.getId(),
            config.getPayoutDaysOfMonth(),
            config.getGracePeriodDays(),
            config.isAutoGenerateEnabled(),
            config.getUpdatedAt()
        );
    }
}
