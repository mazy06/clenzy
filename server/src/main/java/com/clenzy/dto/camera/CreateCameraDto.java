package com.clenzy.dto.camera;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Requete de creation d'une camera. {@code rtspUrl} (avec credentials) est
 * chiffree avant persistance et n'est jamais re-exposee.
 */
public record CreateCameraDto(
        @NotBlank String name,
        @NotNull Long propertyId,
        String roomName,
        String brand,
        @NotBlank String rtspUrl
) {
}
