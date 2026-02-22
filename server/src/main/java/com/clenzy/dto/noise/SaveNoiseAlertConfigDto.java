package com.clenzy.dto.noise;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.util.List;

public record SaveNoiseAlertConfigDto(
    boolean enabled,
    boolean notifyInApp,
    boolean notifyEmail,
    boolean notifyGuestMessage,
    boolean notifyWhatsapp,
    boolean notifySms,

    @Min(5) @Max(1440)
    int cooldownMinutes,

    String emailRecipients,

    @NotEmpty(message = "Au moins un créneau horaire est requis")
    @Valid
    List<TimeWindowInput> timeWindows
) {
    public record TimeWindowInput(
        @NotBlank(message = "Le label du créneau est requis")
        String label,

        @NotNull(message = "L'heure de début est requise")
        String startTime,

        @NotNull(message = "L'heure de fin est requise")
        String endTime,

        @Min(value = 30, message = "Le seuil warning doit être >= 30 dB")
        @Max(value = 120, message = "Le seuil warning doit être <= 120 dB")
        int warningThresholdDb,

        @Min(value = 30, message = "Le seuil critique doit être >= 30 dB")
        @Max(value = 120, message = "Le seuil critique doit être <= 120 dB")
        int criticalThresholdDb
    ) {}
}
