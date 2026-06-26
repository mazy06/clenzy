package com.clenzy.model;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Statut du cycle de vie d'une {@link GuestDeclaration} (fiche de police / declaration voyageur).
 *
 * <ul>
 *   <li>{@code PENDING} : declaration creee/demandee, donnees encore incompletes.</li>
 *   <li>{@code COMPLETED} : tous les champs requis sont renseignes ; prete a etre transmise.</li>
 *   <li>{@code SUBMITTED} : transmise au teleservice de declaration (Chekin / DGSN / Absher)
 *       par {@code ComplianceSubmissionService}. Chekin = integration HTTP reelle ; DGSN/Absher
 *       = stub honnete (en attente de specs/credentials officiels, cf. {@code ComplianceProviderPendingException}).</li>
 * </ul>
 */
public enum DeclarationStatus {
    PENDING("PENDING"),
    COMPLETED("COMPLETED"),
    SUBMITTED("SUBMITTED");

    private final String value;
    DeclarationStatus(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }
}
