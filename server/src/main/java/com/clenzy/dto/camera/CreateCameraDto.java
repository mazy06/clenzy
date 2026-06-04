package com.clenzy.dto.camera;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Requete de creation d'une camera. Deux sources possibles selon {@code brand} :
 * <ul>
 *   <li>RTSP/HTTP direct : {@code rtspUrl} (avec credentials), chiffree avant persistance
 *       et jamais re-exposee.</li>
 *   <li>Provider cloud Tuya ({@code brand=TUYA}) : {@code externalDeviceId} (device_id Tuya) ;
 *       l'URL de flux est allouee a la demande via l'API Tuya. NON VALIDE (pas de device test).</li>
 * </ul>
 * La presence de l'une des deux sources est validee cote service selon le brand.
 */
public record CreateCameraDto(
        @NotBlank String name,
        @NotNull Long propertyId,
        String roomName,
        String brand,
        String rtspUrl,
        String externalDeviceId
) {
}
