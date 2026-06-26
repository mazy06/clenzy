package com.clenzy.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO pour un modele IA plateforme (lecture).
 */
public record PlatformAiModelDto(
        Long id,
        String name,
        String provider,
        String modelId,
        String maskedApiKey,
        String baseUrl,
        List<String> assignedFeatures,
        LocalDateTime lastValidatedAt,
        LocalDateTime updatedAt,
        // Disponibilité (probe proactif) : "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN"
        String availabilityStatus,
        LocalDateTime lastAvailabilityCheckAt,
        String availabilityError
) {}
