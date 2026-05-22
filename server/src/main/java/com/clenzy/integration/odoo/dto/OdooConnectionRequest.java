package com.clenzy.integration.odoo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Payload d'entree pour POST /api/odoo/connect.
 * Utilise un record pour profiter de l'immutabilite et de la validation Bean Validation.
 */
public record OdooConnectionRequest(
        @NotBlank(message = "L'URL serveur est requise")
        @Pattern(regexp = "^https?://[\\w.-]+(:[0-9]+)?(/.*)?$",
                message = "URL serveur invalide (https://...)")
        @Size(max = 500)
        String serverUrl,

        @NotBlank(message = "Le nom de base est requis")
        @Size(max = 200)
        String databaseName,

        @NotBlank(message = "Le login utilisateur est requis")
        @Size(max = 200)
        String userLogin,

        @NotBlank(message = "L'API key est requise")
        @Size(min = 8, max = 500, message = "L'API key doit faire entre 8 et 500 caracteres")
        String apiKey
) {}
