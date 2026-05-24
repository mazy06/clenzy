package com.clenzy.dto.amenity;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateIgnoredRequest(
    @NotBlank @Size(max = 200) String rawOtaName,
    @Size(max = 40) String otaSource,
    boolean applyToProperties
) {}
