package com.clenzy.controller;

import com.clenzy.dto.keyexchange.KeyExchangePointPhotoDto;
import com.clenzy.service.KeyExchangePointPhotoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * Photos de l'emplacement exact d'un point de remise des clés.
 *
 * <ul>
 *   <li>POST   /api/key-exchange/points/{pointId}/photos                 → ajouter (multipart « photos »)</li>
 *   <li>GET    /api/key-exchange/points/{pointId}/photos/{photoId}/data  → binaire</li>
 *   <li>DELETE /api/key-exchange/points/{pointId}/photos/{photoId}       → supprimer</li>
 * </ul>
 *
 * <p>Lecture ouverte aux membres de l'organisation (intervenants compris : ce sont
 * eux qui cherchent la boîte sur place) ; ajout et suppression réservés aux gestionnaires.
 * L'appartenance du point à l'organisation est vérifiée par le service.</p>
 */
@RestController
@RequestMapping("/api/key-exchange/points/{pointId}/photos")
@Tag(name = "Key Exchange", description = "Photos d'emplacement des points de remise des cles")
@PreAuthorize("isAuthenticated()")
public class KeyExchangePointPhotoController {

    private final KeyExchangePointPhotoService photoService;

    public KeyExchangePointPhotoController(KeyExchangePointPhotoService photoService) {
        this.photoService = photoService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER', 'HOST')")
    @Operation(summary = "Ajouter des photos d'emplacement a un point de remise")
    public ResponseEntity<List<KeyExchangePointPhotoDto>> addPhotos(@PathVariable Long pointId,
                                                                    @RequestParam("photos") List<MultipartFile> photos,
                                                                    @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(photoService.addPhotos(pointId, photos, jwt.getSubject()));
    }

    @GetMapping("/{photoId}/data")
    @Operation(summary = "Lire le binaire d'une photo d'emplacement")
    public ResponseEntity<byte[]> photoData(@PathVariable Long pointId, @PathVariable Long photoId) {
        KeyExchangePointPhotoService.PhotoBytes photo = photoService.readPhoto(pointId, photoId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, photo.contentType())
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=3600")
                .body(photo.bytes());
    }

    @DeleteMapping("/{photoId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER', 'HOST')")
    @Operation(summary = "Supprimer une photo d'emplacement")
    public ResponseEntity<Void> deletePhoto(@PathVariable Long pointId, @PathVariable Long photoId) {
        photoService.deletePhoto(pointId, photoId);
        return ResponseEntity.noContent().build();
    }
}
