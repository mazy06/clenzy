package com.clenzy.dto;

/**
 * Profil reglementaire France d'un logement (fiche logement > Conformite).
 *
 * <p>Lecture : tout est calcule serveur. Le numero d'enregistrement vient de la licence
 * {@code TOURISM_REGISTRATION} (source unique) ; il se modifie par l'API des licences,
 * jamais par ce profil.</p>
 */
public record FrRegulatoryProfileDto(
        Long propertyId,
        String countryCode,
        String communeInseeCode,
        String rentalUse,
        /** Numero d'enregistrement (licence TOURISM_REGISTRATION), {@code null} si absent. */
        String registrationNumber,
        /** {@code TourismLicense.Verdict} du numero au regard de la commune actuelle. */
        String registrationVerdict,
        /** Le numero est exige pour cet usage (tout meuble de tourisme, hors chambre d'hotes). */
        boolean registrationRequired,
        boolean nightsCapEnabled,
        int maxNightsPerYear,
        int nightsRentedThisYear,
        int nightsRemainingThisYear,
        boolean policeFormEnabled
) {
    /**
     * Ecriture : seuls ces champs sont modifiables par le profil. La commune n'en fait pas
     * partie : elle est DEDUITE de l'adresse du logement (Base Adresse Nationale).
     */
    public record Update(
            String rentalUse,
            Integer maxNightsPerYear,
            Boolean policeFormEnabled
    ) {
    }
}
