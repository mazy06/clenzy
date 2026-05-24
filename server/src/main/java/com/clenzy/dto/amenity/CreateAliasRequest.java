package com.clenzy.dto.amenity;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Body de {@code POST /api/amenity-management/aliases}.
 *
 * @param rawOtaName       nom brut OTA (ex "Smoke alarm")
 * @param clenzyCode       code Clenzy cible (built-in ou custom_amenities.code)
 * @param otaSource        source OTA optionnelle (AirBNB, BookingCom, ...)
 * @param applyToProperties si true, reprocess immediat des properties affectees
 */
public record CreateAliasRequest(
    @NotBlank @Size(max = 200) String rawOtaName,
    @NotBlank @Size(max = 80) String clenzyCode,
    @Size(max = 40) String otaSource,
    boolean applyToProperties
) {

    /**
     * Body de bulk-create : map plusieurs rawNames sur un meme code en un seul appel.
     */
    public record BulkRequest(
        @NotBlank @Size(max = 80) String clenzyCode,
        List<@NotBlank String> rawOtaNames,
        @Size(max = 40) String otaSource,
        boolean applyToProperties
    ) {}
}
