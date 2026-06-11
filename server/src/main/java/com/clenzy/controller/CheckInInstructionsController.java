package com.clenzy.controller;

import com.clenzy.dto.CheckInInstructionsDto;
import com.clenzy.dto.UpdateCheckInInstructionsDto;
import com.clenzy.service.CheckInInstructionsService;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * Gestion des instructions check-in/check-out par propriete.
 * Backend pour le formulaire CheckInInstructionsForm.tsx.
 */
@RestController
@RequestMapping("/api/properties/{propertyId}/check-in-instructions")
@PreAuthorize("isAuthenticated()")
public class CheckInInstructionsController {

    private final CheckInInstructionsService checkInInstructionsService;

    public CheckInInstructionsController(CheckInInstructionsService checkInInstructionsService) {
        this.checkInInstructionsService = checkInInstructionsService;
    }

    @GetMapping
    public ResponseEntity<CheckInInstructionsDto> get(
            @PathVariable Long propertyId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        return checkInInstructionsService.getInstructions(propertyId, jwt.getSubject())
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Code d'accès courant généré par la serrure connectée du logement (séjour en cours/à venir),
     * pour pré-remplir le champ code. {@code hasSmartLock=false} si aucune serrure → boîte à clé.
     */
    @GetMapping("/smart-lock-code")
    public ResponseEntity<Map<String, Object>> getSmartLockCode(
            @PathVariable Long propertyId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        var status = checkInInstructionsService.getSmartLockCode(propertyId, jwt.getSubject());
        return ResponseEntity.ok(Map.of("hasSmartLock", status.hasSmartLock(), "code", status.code()));
    }

    @PutMapping
    @CacheEvict(value = "properties", allEntries = true)
    public ResponseEntity<CheckInInstructionsDto> update(
            @PathVariable Long propertyId,
            @RequestBody UpdateCheckInInstructionsDto dto,
            @AuthenticationPrincipal Jwt jwt
    ) {
        return ResponseEntity.ok(checkInInstructionsService.update(propertyId, dto, jwt.getSubject()));
    }

    /**
     * Upload d'une photo d'indication d'acces. Stocke le binaire et renvoie la cle
     * de stockage ; le front l'ajoute au JSON {@code arrivalPhotos} puis PUT.
     * Le binaire est servi a la page guest via {@code GET /api/public/guide/{token}/access-photos/{key}}.
     */
    @PostMapping(value = "/access-photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadAccessPhoto(
            @PathVariable Long propertyId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal Jwt jwt
    ) {
        String key = checkInInstructionsService.uploadAccessPhoto(propertyId, jwt.getSubject(), file);
        return ResponseEntity.ok(Map.of("key", key));
    }

    /**
     * Sert une photo d'indication d'acces cote admin (apercu dans le formulaire). Auth + acces
     * propriete + verification que la cle appartient bien aux arrivalPhotos enregistrees.
     */
    @GetMapping("/access-photos")
    public ResponseEntity<byte[]> getAccessPhoto(
            @PathVariable Long propertyId,
            @RequestParam("key") String key,
            @AuthenticationPrincipal Jwt jwt
    ) {
        return checkInInstructionsService.findAccessPhoto(propertyId, jwt.getSubject(), key)
            .map(data -> ResponseEntity.ok().contentType(sniffImageType(data)).body(data))
            .orElse(ResponseEntity.notFound().build());
    }

    private static MediaType sniffImageType(byte[] d) {
        if (d.length >= 2 && (d[0] & 0xFF) == 0xFF && (d[1] & 0xFF) == 0xD8) return MediaType.IMAGE_JPEG;
        if (d.length >= 4 && (d[0] & 0xFF) == 0x89 && d[1] == 'P' && d[2] == 'N' && d[3] == 'G') return MediaType.IMAGE_PNG;
        if (d.length >= 3 && d[0] == 'G' && d[1] == 'I' && d[2] == 'F') return MediaType.IMAGE_GIF;
        if (d.length >= 12 && d[0] == 'R' && d[1] == 'I' && d[2] == 'F' && d[3] == 'F'
                && d[8] == 'W' && d[9] == 'E' && d[10] == 'B' && d[11] == 'P') return MediaType.parseMediaType("image/webp");
        return MediaType.IMAGE_JPEG;
    }
}
