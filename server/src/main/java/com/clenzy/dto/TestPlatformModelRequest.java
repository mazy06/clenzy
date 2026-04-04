package com.clenzy.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * DTO pour tester la connexion a un modele IA plateforme.
 */
public record TestPlatformModelRequest(
        @NotBlank(message = "Provider is required")
        String provider,

        @NotBlank(message = "Model ID is required")
        String modelId,

        @NotBlank(message = "API key is required")
        String apiKey,

        String baseUrl
) {}
