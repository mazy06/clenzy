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
        boolean sendEmail,
        // Force l'envoi de l'email meme si un document a deja ete envoye a ce
        // destinataire pour cette reference (bouton "Renvoyer"). Par defaut false :
        // le service deduplique (1 email par destinataire/document).
        boolean forceResend,
        // Overrides de l'editeur "Renvoyer" : objet + corps plain text personnalises.
        // Nullable → contenu par defaut du template. emailBody "" = corps vide volontaire.
        String emailSubject,
        String emailBody
) {
    /**
     * Constructeur retro-compatible (sans forceResend/overrides email, defauts).
     * Conserve pour les appelants Java existants ; la deserialisation JSON utilise
     * le constructeur canonique (champs absents du payload → false/null).
     */
    public GenerateDocumentRequest(String documentType, Long referenceId,
                                   String referenceType, String emailTo, boolean sendEmail) {
        this(documentType, referenceId, referenceType, emailTo, sendEmail, false, null, null);
    }
}
