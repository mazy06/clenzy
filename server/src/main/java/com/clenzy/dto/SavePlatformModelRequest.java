package com.clenzy.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * DTO pour creer ou mettre a jour un modele IA plateforme.
 */
public record SavePlatformModelRequest(
        Long id,

        @NotBlank(message = "Name is required")
        String name,

        @NotBlank(message = "Provider is required")
        String provider,

        @NotBlank(message = "Model ID is required")
        String modelId,

        @NotBlank(message = "API key is required")
        String apiKey,

        String baseUrl
) {}
