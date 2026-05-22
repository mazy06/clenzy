package com.clenzy.integration.external.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Payload de POST /api/integrations/external/{providerType}/connect.
 * Format generique, valide pour Yousign / Universign / DocaPoste.
 */
public record ExternalConnectionRequest(
        @NotBlank(message = "L'URL serveur est requise")
        @Pattern(regexp = "^https?://[\\w.-]+(:[0-9]+)?(/.*)?$",
                message = "URL serveur invalide (https://...)")
        @Size(max = 500)
        String serverUrl,

        /** Optionnel : id de compte, nom de tenant, db name, etc. selon le provider. */
        @Size(max = 200)
        String accountIdentifier,

        @NotBlank(message = "L'API key est requise")
        @Size(min = 8, max = 500)
        String apiKey
) {}
