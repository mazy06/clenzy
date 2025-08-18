package com.clenzy.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.Map;

@Schema(description = "Modèle d'erreur retourné par l'API")
public class ApiError {
    @Schema(description = "Date et heure de l'erreur", example = "2025-08-11T00:00:00Z")
    public OffsetDateTime timestamp;
    @Schema(description = "Code HTTP", example = "400")
    public int status;
    @Schema(description = "Libellé du code HTTP", example = "Bad Request")
    public String error;
    @Schema(description = "Message d'erreur")
    public String message;
    @Schema(description = "Chemin de la requête", example = "/api/users/1")
    public String path;
    @Schema(description = "Erreurs de validation par champ")
    public Map<String, String> validationErrors;
}


