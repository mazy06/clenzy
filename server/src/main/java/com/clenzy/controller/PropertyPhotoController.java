package com.clenzy.controller;

import com.clenzy.dto.PropertyPhotoDto;
import com.clenzy.service.PropertyPhotoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/properties/{propertyId}/photos")
@Tag(name = "Property Photos", description = "Gestion des photos de proprietes")
@PreAuthorize("isAuthenticated()")
public class PropertyPhotoController {

    private final PropertyPhotoService photoService;

    public PropertyPhotoController(PropertyPhotoService photoService) {
        this.photoService = photoService;
    }

    @GetMapping
    @Operation(summary = "Lister les photos d'une propriete (metadonnees uniquement)")
    public ResponseEntity<List<PropertyPhotoDto>> listPhotos(@PathVariable Long propertyId) {
        return ResponseEntity.ok(photoService.listPhotos(propertyId));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Uploader une photo pour une propriete")
    public ResponseEntity<PropertyPhotoDto> uploadPhoto(
            @PathVariable Long propertyId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "caption", required = false) String caption) {
        final PropertyPhotoDto dto = photoService.uploadPhoto(propertyId, file, caption);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @GetMapping("/{photoId}/data")
    @Operation(summary = "Recuperer le binaire d'une photo")
    public ResponseEntity<byte[]> getPhotoData(
            @PathVariable Long propertyId,
            @PathVariable Long photoId) {
        final byte[] data = photoService.getPhotoData(propertyId, photoId);
        final String contentType = photoService.getPhotoContentType(propertyId, photoId);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePublic())
                .body(data);
    }

    @DeleteMapping("/{photoId}")
    @Operation(summary = "Supprimer une photo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePhoto(
            @PathVariable Long propertyId,
            @PathVariable Long photoId) {
        photoService.deletePhoto(propertyId, photoId);
    }

    @PutMapping("/reorder")
    @Operation(summary = "Reordonner les photos d'une propriete")
    public ResponseEntity<Void> reorderPhotos(
            @PathVariable Long propertyId,
            @RequestBody List<Long> photoIds) {
        photoService.reorderPhotos(propertyId, photoIds);
        return ResponseEntity.ok().build();
    }
}
