package com.clenzy.dto.amenity;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body de {@code POST /api/amenity-management/custom}.
 *
 * @param labelFr            label francais obligatoire
 * @param labelEn            label anglais optionnel
 * @param category           comfort | kitchen | appliances | outdoor | safetyFamily | custom
 * @param code               optionnel — sinon genere automatiquement depuis labelFr
 * @param createAliasForRaw  optionnel — si fourni, cree aussi un alias rawName → code
 * @param applyToProperties  si true, reprocess immediat des properties qui ont rawName
 */
public record CreateCustomAmenityRequest(
    @NotBlank @Size(max = 120) String labelFr,
    @Size(max = 120) String labelEn,
    String category,
    @Size(max = 80) String code,
    String createAliasForRaw,
    boolean applyToProperties
) {}
