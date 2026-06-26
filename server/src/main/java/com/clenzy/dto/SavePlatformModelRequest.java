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

        // Optionnel : si vide, le serveur réutilise une clé existante pour le
        // provider (modèle plateforme déjà configuré, ou connexion BYOK de l'org).
        String apiKey,

        String baseUrl
) {}
