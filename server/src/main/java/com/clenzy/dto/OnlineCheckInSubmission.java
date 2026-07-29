package com.clenzy.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Ce que le voyageur transmet en validant son check-in en ligne.
 *
 * <p>Un objet paramètre plutôt que dix-sept arguments positionnels : la méthode
 * en comptait déjà onze, et l'ajout des champs d'identité l'aurait rendue
 * illisible — puis dangereuse, deux chaînes voisines s'intervertissant sans que
 * le compilateur bronche.</p>
 *
 * <p><b>Deux blocs, une seule saisie.</b> Le premier sert l'accueil (qui arrive,
 * quand, avec quelles demandes). Le second sert la <b>fiche voyageur</b> — fiche
 * de police, DGSN selon le pays. Ils étaient collectés séparément : le voyageur
 * pouvait compléter intégralement son check-in sans que la fiche existe, et le
 * tableau de bord lui reprochait ensuite une formalité qu'on ne lui avait jamais
 * demandée.</p>
 *
 * @param birthDate date de naissance ISO {@code yyyy-MM-dd}
 */
public record OnlineCheckInSubmission(
        @NotBlank String firstName,
        @NotBlank String lastName,
        String email,
        String phone,
        String idDocumentNumber,
        String idDocumentType,
        String estimatedArrivalTime,
        String specialRequests,
        Integer numberOfGuests,
        String additionalGuests,

        // ── Identité, pour la fiche voyageur ────────────────────────────────
        String maidenName,
        String birthDate,
        String birthPlace,
        String nationality,
        String residenceAddress,
        String residenceCountry) {

    /**
     * Vrai si la fiche voyageur peut être établie à partir de cette saisie.
     *
     * <p>En deçà, on ne crée rien : une fiche incomplète serait réputée déposée
     * sans l'être, ce qui est pire que pas de fiche du tout — l'alerte
     * disparaîtrait alors que l'obligation resterait.</p>
     */
    public boolean carriesIdentity() {
        return isFilled(firstName) && isFilled(lastName)
                && isFilled(birthDate) && isFilled(nationality);
    }

    private static boolean isFilled(String value) {
        return value != null && !value.isBlank();
    }
}
