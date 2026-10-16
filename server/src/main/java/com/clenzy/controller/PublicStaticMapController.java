package com.clenzy.controller;

import com.clenzy.service.maps.StaticMapRenderer;
import com.clenzy.service.maps.StaticMapRequest;
import com.clenzy.service.maps.StaticMapSigner;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClientException;

import java.time.Duration;

/**
 * Images de carte des e-mails, chargées par les clients mail sans session.
 *
 * <p>Public ({@code /api/public/**} est ouvert dans SecurityConfigProd) mais pas
 * libre : l'URL porte un jeton SIGNÉ par le serveur ({@link StaticMapSigner}) ;
 * une signature invalide répond 404 sans rendu. L'image d'un jeton ne change
 * jamais : cache public immuable, le CDN absorbe les relectures.</p>
 */
@RestController
@RequestMapping("/api/public/maps")
@Tag(name = "Public maps", description = "Images de carte Baitly des e-mails")
@PreAuthorize("permitAll()")
public class PublicStaticMapController {

    private static final Logger log = LoggerFactory.getLogger(PublicStaticMapController.class);

    private final StaticMapSigner signer;
    private final StaticMapRenderer renderer;

    public PublicStaticMapController(StaticMapSigner signer, StaticMapRenderer renderer) {
        this.signer = signer;
        this.renderer = renderer;
    }

    @GetMapping("/static/{payload}.{signature}.jpg")
    @Operation(summary = "Image de carte signee (e-mails)")
    public ResponseEntity<byte[]> staticMap(@PathVariable String payload, @PathVariable String signature) {
        if (!signer.verify(payload, signature) || !renderer.isEnabled()) {
            return ResponseEntity.notFound().build();
        }
        StaticMapRequest request = StaticMapRequest.fromPayload(payload).orElse(null);
        if (request == null) {
            return ResponseEntity.notFound().build();
        }
        try {
            return ResponseEntity.ok()
                    .contentType(MediaType.IMAGE_JPEG)
                    .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                    .body(renderer.render(request));
        } catch (RestClientException e) {
            // Moteur indisponible : l'e-mail affiche son texte alternatif, rien d'autre ne casse.
            log.warn("Rendu de carte indisponible : {}", e.getMessage());
            return ResponseEntity.status(503).build();
        }
    }

    /** Zoom maximal servi : au-delà, la tuile n'apporte rien de plus que la précédente agrandie. */
    private static final int MAX_RASTER_ZOOM = 18;
    private static final java.util.Set<String> RASTER_LANGUAGES = java.util.Set.of("fr", "en", "ar");

    /**
     * Tuiles raster du style Papier pour l'application mobile. Ensemble borné
     * (langue autorisée, grille XYZ valide) : rien d'arbitraire n'est rendu.
     */
    @GetMapping("/raster/{language}/{z}/{x}/{y}.png")
    @Operation(summary = "Tuile raster Baitly (application mobile)")
    public ResponseEntity<byte[]> rasterTile(@PathVariable String language, @PathVariable int z,
                                             @PathVariable int x, @PathVariable int y) {
        if (!RASTER_LANGUAGES.contains(language) || !isValidTile(z, x, y) || !renderer.isEnabled()) {
            return ResponseEntity.notFound().build();
        }
        try {
            return ResponseEntity.ok()
                    .contentType(MediaType.IMAGE_PNG)
                    .cacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePublic())
                    .body(renderer.tile(language, z, x, y));
        } catch (RestClientException e) {
            log.warn("Tuile raster indisponible z={} x={} y={} : {}", z, x, y, e.getMessage());
            return ResponseEntity.status(503).build();
        }
    }

    static boolean isValidTile(int z, int x, int y) {
        if (z < 0 || z > MAX_RASTER_ZOOM) return false;
        long size = 1L << z;
        return x >= 0 && y >= 0 && x < size && y < size;
    }
}
