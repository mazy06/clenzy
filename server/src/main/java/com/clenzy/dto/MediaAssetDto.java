package com.clenzy.dto;

import com.clenzy.model.MediaAsset;

import java.time.Instant;

/**
 * Vue d'un média de la médiathèque (2.1). {@code url} est l'endpoint public keyless de service du
 * binaire ({@code /api/public/media/t/{publicToken}}) — relatif, rendu absolu par le widget/site
 * via sa baseUrl.
 *
 * <p>L'URL porte le <b>jeton opaque</b> et non l'identifiant : l'ancienne forme
 * {@code /api/public/media/{id}} était énumérable par un anonyme et exposait la médiathèque de
 * toutes les organisations (audit 2026-07-26, constat P1-06). Elle reste servie pour les pages
 * publiées avant ce changement, mais n'est plus jamais produite ici.
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
            "/api/public/media/t/" + m.getPublicToken(),
            m.getFileName(),
            m.getContentType(),
            m.getFileSize(),
            m.getCreatedAt());
    }
}
