package com.clenzy.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record GenerateDocumentRequest(
        @NotBlank(message = "Le type de document est obligatoire")
        String documentType,
        @NotNull(message = "L'identifiant de reference est obligatoire")
        @Positive(message = "L'identifiant de reference doit etre positif")
        Long referenceId,
        @NotBlank(message = "Le type de reference est obligatoire")
        String referenceType,
        @Email(message = "L'adresse email n'est pas valide")
        String emailTo,
        boolean sendEmail
) {}
