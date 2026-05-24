package com.clenzy.dto.amenity;

import java.time.LocalDateTime;

public record CustomAmenityDto(
    Long id,
    String code,
    String labelFr,
    String labelEn,
    String category,
    LocalDateTime createdAt,
    String createdByEmail
) {}
