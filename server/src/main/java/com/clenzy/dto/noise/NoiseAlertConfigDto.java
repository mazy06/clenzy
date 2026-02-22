package com.clenzy.dto.noise;

import com.clenzy.model.NoiseAlertConfig;

import java.util.List;

public record NoiseAlertConfigDto(
    Long id,
    Long propertyId,
    String propertyName,
    boolean enabled,
    boolean notifyInApp,
    boolean notifyEmail,
    boolean notifyGuestMessage,
    boolean notifyWhatsapp,
    boolean notifySms,
    int cooldownMinutes,
    String emailRecipients,
    List<TimeWindowDto> timeWindows
) {
    public record TimeWindowDto(
        Long id,
        String label,
        String startTime,
        String endTime,
        int warningThresholdDb,
        int criticalThresholdDb
    ) {}

    public static NoiseAlertConfigDto from(NoiseAlertConfig config) {
        String propertyName = config.getProperty() != null
            ? config.getProperty().getName()
            : null;

        List<TimeWindowDto> windows = config.getTimeWindows().stream()
            .map(tw -> new TimeWindowDto(
                tw.getId(),
                tw.getLabel(),
                tw.getStartTime().toString(),
                tw.getEndTime().toString(),
                tw.getWarningThresholdDb(),
                tw.getCriticalThresholdDb()
            ))
            .toList();

        return new NoiseAlertConfigDto(
            config.getId(),
            config.getPropertyId(),
            propertyName,
            config.isEnabled(),
            config.isNotifyInApp(),
            config.isNotifyEmail(),
            config.isNotifyGuestMessage(),
            config.isNotifyWhatsapp(),
            config.isNotifySms(),
            config.getCooldownMinutes(),
            config.getEmailRecipients(),
            windows
        );
    }
}
