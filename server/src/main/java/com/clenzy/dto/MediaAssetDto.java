package com.clenzy.dto;

import com.clenzy.model.MediaAsset;

import java.time.Instant;

/**
 * Vue d'un média de la médiathèque (2.1). {@code url} est l'endpoint public keyless de service du
 * binaire ({@code /api/public/media/{id}}) — relatif, rendu absolu par le widget/site via sa baseUrl.
 */
public record MediaAssetDto(
    Long id,
    String url,
    String fileName,
    String contentType,
    long fileSize,
    Instant createdAt
) {
    public static MediaAssetDto from(MediaAsset m) {
        return new MediaAssetDto(
            m.getId(),
            "/api/public/media/" + m.getId(),
            m.getFileName(),
            m.getContentType(),
            m.getFileSize(),
            m.getCreatedAt());
    }
}
