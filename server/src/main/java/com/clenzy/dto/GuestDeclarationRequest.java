package com.clenzy.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * Payload public de soumission de la fiche de police / declaration voyageur.
 *
 * <p>Envoye par le voyageur depuis le livret d'accueil ({@code POST
 * /api/public/guide/{token}/declaration}). L'organisation et la reservation sont resolues
 * <b>serveur</b> a partir du token (jamais depuis ce body) — cf. {@code GuestDeclarationService}.
 * On ne transporte ici que les champs d'identite saisis par le voyageur.</p>
 *
 * <p>Le premier element de {@link #declarants()} est traite comme le voyageur principal ; les
 * suivants comme accompagnants.</p>
 */
public record GuestDeclarationRequest(
    @NotEmpty @Valid List<Declarant> declarants,
    /** Le voyageur certifie l'exactitude des informations : vaut signature de la fiche (France). */
    Boolean certified
) {
    public GuestDeclarationRequest(List<Declarant> declarants) {
        this(declarants, null);
    }

    /** Identite d'un voyageur a declarer (principal ou accompagnant). Tous champs PII. */
    public record Declarant(
        String firstName,
        String lastName,
        String maidenName,
        /** Date de naissance ISO {@code yyyy-MM-dd}. */
        String birthDate,
        String birthPlace,
        String nationality,
        String residenceAddress,
        String residenceCountry,
        String idDocumentType,
        String idDocumentNumber,
        /** Telephone mobile et adresse electronique (France, CESEDA R814-2). */
        String phone,
        String email
    ) {
        public Declarant(String firstName, String lastName, String maidenName, String birthDate,
                         String birthPlace, String nationality, String residenceAddress,
                         String residenceCountry, String idDocumentType, String idDocumentNumber) {
            this(firstName, lastName, maidenName, birthDate, birthPlace, nationality, residenceAddress,
                residenceCountry, idDocumentType, idDocumentNumber, null, null);
        }
    }
}
