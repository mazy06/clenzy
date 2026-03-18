package com.clenzy.dto;

import java.time.Instant;
import java.util.List;

public record OnboardingStatusDto(
    String role,
    boolean dismissed,
    List<StepDto> steps
) {
    public record StepDto(
        String key,
        boolean completed,
        Instant completedAt
    ) {}
}
