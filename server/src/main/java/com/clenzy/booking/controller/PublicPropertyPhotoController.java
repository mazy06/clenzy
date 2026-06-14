package com.clenzy.booking.controller;

import com.clenzy.booking.service.PublicPropertyPhotoService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.TimeUnit;

/**
 * Photos de propriété PUBLIQUES pour le booking engine (img-friendly, sans clé). Sous /api/public/**
 * (permitAll dans SecurityConfigProd) et HORS /api/public/booking/** (pas de filtre X-Booking-Key,
 * qu'une balise &lt;img&gt; ne pourrait pas envoyer). Sert uniquement les biens booking-engine-visibles.
 */
@RestController
@RequestMapping("/api/public/property-photos")
@Tag(name = "Public Property Photos", description = "Photos publiques des biens du booking engine")
@PreAuthorize("permitAll()")
public class PublicPropertyPhotoController {

    private final PublicPropertyPhotoService photoService;

    public PublicPropertyPhotoController(PublicPropertyPhotoService photoService) {
        this.photoService = photoService;
    }

    @GetMapping("/{propertyId}/{photoId}")
    public ResponseEntity<byte[]> getPhoto(@PathVariable Long propertyId, @PathVariable Long photoId) {
        PublicPropertyPhotoService.PublicPhoto photo = photoService.getVisiblePhoto(propertyId, photoId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(photo.contentType()))
                .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePublic())
                .body(photo.data());
    }
}
