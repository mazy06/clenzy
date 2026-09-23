package com.clenzy.dto;

import com.clenzy.model.PropertyLicense;
import com.clenzy.service.property.TourismLicense;

import java.time.LocalDate;

/**
 * Licence/autorisation d'un logement (vague M-A) — shape stable pour la fiche logement.
 *
 * <p>{@code formatVerdict} et {@code expiringSoon} sont calcules par le serveur et
 * IGNORES en ecriture : le meme record sert de requete, les y renseigner n'a aucun
 * effet.</p>
 */
public record PropertyLicenseDto(
        Long id,
        Long propertyId,
        String licenseType,
        String licenseNumber,
        String issuedBy,
        LocalDate issuedAt,
        LocalDate expiresAt,
        int renewalLeadDays,
        String documentRef,
        String notes,
        /** Lecture seule — {@link TourismLicense.Verdict}. */
        String formatVerdict,
        /** Lecture seule — l'echeance tombe dans le preavis de renouvellement. */
        boolean expiringSoon
) {
    /**
     * @param countryCode  pays du logement : le format d'une licence est national
     * @param propertyZone fuseau du logement : une licence se perime chez elle,
     *                     pas a l'heure de la JVM
     */
    public static PropertyLicenseDto from(PropertyLicense license, String countryCode, String propertyZone) {
        // Le controle de forme ne vaut que pour la licence d'exploitation touristique :
        // un certificat de securite ou une piece « autre » n'a pas de format national.
        boolean tourism = license.getLicenseType() == PropertyLicense.LicenseType.TOURISM_REGISTRATION;
        TourismLicense.Verdict verdict = tourism
                ? TourismLicense.check(countryCode, license.getLicenseNumber())
                : TourismLicense.Verdict.UNCHECKED;

        return new PropertyLicenseDto(
                license.getId(),
                license.getPropertyId(),
                license.getLicenseType() != null ? license.getLicenseType().name() : null,
                license.getLicenseNumber(),
                license.getIssuedBy(),
                license.getIssuedAt(),
                license.getExpiresAt(),
                license.getRenewalLeadDays(),
                license.getDocumentRef(),
                license.getNotes(),
                verdict.name(),
                TourismLicense.expiresWithin(license.getExpiresAt(), propertyZone, license.getRenewalLeadDays()));
    }
}
