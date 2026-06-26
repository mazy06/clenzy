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
    @NotEmpty @Valid List<Declarant> declarants
) {
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
        String idDocumentNumber
    ) {}
}
