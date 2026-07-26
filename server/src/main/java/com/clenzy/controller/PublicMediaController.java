package com.clenzy.controller;

import com.clenzy.service.MediaLibraryService;
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

import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Service public du binaire d'un média de la médiathèque (2.1). Keyless : le contenu est destiné au
 * site/widget public. {@code permitAll} autorisé car {@code /api/public/**} est dans la liste
 * permitAll de SecurityConfigProd.
 *
 * <p>Deux routes coexistent volontairement :
 * <ul>
 *   <li>{@code /t/{publicToken}} — <b>la route courante</b>. Le jeton est opaque, la médiathèque
 *       n'est donc pas énumérable.</li>
 *   <li>{@code /{id}} — <b>dépréciée</b>. L'identifiant est séquentiel : elle permettait à un
 *       anonyme de parcourir la médiathèque de toutes les organisations (audit 2026-07-26,
 *       constat P1-06). Elle n'est conservée que parce que ces URLs sont figées dans les pages
 *       déjà publiées, et sera retirée une fois celles-ci republiées.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/public/media")
@PreAuthorize("permitAll()")
public class PublicMediaController {

    private static final Logger log = LoggerFactory.getLogger(PublicMediaController.class);

    private final MediaLibraryService service;

    public PublicMediaController(MediaLibraryService service) {
        this.service = service;
    }

    /** Route courante : le jeton opaque n'est pas devinable. */
    @GetMapping("/t/{publicToken}")
    public ResponseEntity<byte[]> serveByToken(@PathVariable UUID publicToken) {
        return respond(service.serveByToken(publicToken));
    }

    /**
     * Route héritée, servie pour ne pas casser les pages publiées avant l'introduction du jeton.
     *
     * <p>Chaque appel est tracé : c'est cette trace qui dira quand plus aucune page publiée n'en
     * dépend, et donc quand la route peut être retirée sans casse. Le niveau reste {@code debug}
     * — un site à fort trafic passe encore massivement par ici, un {@code warn} noierait les logs.
     *
     * @deprecated Identifiant séquentiel et donc énumérable (audit P1-06).
     */
    @Deprecated(since = "2026-07-26")
    @GetMapping("/{id}")
    public ResponseEntity<byte[]> serve(@PathVariable Long id) {
        log.debug("Media servi via la route depreciee par identifiant (P1-06) : id={}", id);
        return respond(service.serve(id));
    }

    private ResponseEntity<byte[]> respond(MediaLibraryService.ServedMedia media) {
        if (media == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(media.contentType()))
            .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePublic())
            .body(media.data());
    }
}
