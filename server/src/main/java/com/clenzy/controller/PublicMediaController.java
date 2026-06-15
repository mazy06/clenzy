package com.clenzy.controller;

import com.clenzy.service.MediaLibraryService;
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
 * Service public du binaire d'un média de la médiathèque (2.1). Keyless : le contenu est destiné au
 * site/widget public. {@code permitAll} autorisé car {@code /api/public/**} est dans la liste
 * permitAll de SecurityConfigProd. L'id résout un média réel (garde-fou contre la lecture arbitraire).
 */
@RestController
@RequestMapping("/api/public/media")
@PreAuthorize("permitAll()")
public class PublicMediaController {

    private final MediaLibraryService service;

    public PublicMediaController(MediaLibraryService service) {
        this.service = service;
    }

    @GetMapping("/{id}")
    public ResponseEntity<byte[]> serve(@PathVariable Long id) {
        MediaLibraryService.ServedMedia media = service.serve(id);
        if (media == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(media.contentType()))
            .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePublic())
            .body(media.data());
    }
}
