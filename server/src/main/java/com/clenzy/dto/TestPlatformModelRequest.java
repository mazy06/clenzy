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

        // Optionnel : si vide, le serveur réutilise une clé déjà configurée pour
        // le provider (permet de tester un changement de modèle sur une config
        // existante sans recoller la clé).
        String apiKey,

        String baseUrl
) {}
