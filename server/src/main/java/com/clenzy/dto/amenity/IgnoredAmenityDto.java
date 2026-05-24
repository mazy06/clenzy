package com.clenzy.dto.amenity;

import java.time.LocalDateTime;

public record IgnoredAmenityDto(
    Long id,
    String rawOtaName,
    String otaSource,
    LocalDateTime createdAt
) {}
