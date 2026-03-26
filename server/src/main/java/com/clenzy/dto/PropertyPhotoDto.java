package com.clenzy.dto;

import java.time.LocalDateTime;

/**
 * DTO for property photo metadata (no binary data).
 */
public record PropertyPhotoDto(
    Long id,
    Long propertyId,
    String originalFilename,
    String contentType,
    Long fileSize,
    int sortOrder,
    String caption,
    String source,
    LocalDateTime createdAt
) {}
