package com.clenzy.dto.amenity;

import java.time.LocalDateTime;

public record AmenityAliasDto(
    Long id,
    String rawOtaName,
    String clenzyCode,
    String otaSource,
    LocalDateTime createdAt,
    String createdByEmail
) {}
