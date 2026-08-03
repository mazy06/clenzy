package com.clenzy.dto;

import com.clenzy.model.PropertyLicense;

import java.time.LocalDate;

/** Licence/autorisation d'un logement (vague M-A) — shape stable pour la fiche logement. */
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
        String notes
) {
    public static PropertyLicenseDto from(PropertyLicense license) {
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
                license.getNotes());
    }
}
