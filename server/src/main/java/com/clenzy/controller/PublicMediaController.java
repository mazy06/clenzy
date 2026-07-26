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

import java.util.concurrent.atomic.AtomicLong;
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

    /**
     * Compteur d'usage de la route heritee.
     *
     * <p>Le {@code log.debug} initial etait inexploitable : la production tourne en
     * {@code com.clenzy: info}, il n'etait donc jamais emis. On ne pouvait pas savoir si
     * la route servait encore — et retirer une route sans cette mesure reviendrait a parier
     * que plus aucune page publiee n'en depend (audit 2026-07-26, constat P1-06).
     *
     * <p>Un compteur plutot qu'un log par appel : cette route peut servir des milliers
     * d'images par heure sur un site actif. Le total est journalise periodiquement, ce qui
     * donne l'ordre de grandeur sans inonder.
     */
    private static final AtomicLong APPELS_ROUTE_HERITEE = new AtomicLong();

    /** Horodatage du dernier releve, pour ne journaliser qu'une fois par heure. */
    private static final AtomicLong DERNIER_RELEVE = new AtomicLong(System.currentTimeMillis());

    private static final long INTERVALLE_RELEVE_MS = 3_600_000L;

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
     * <p>Chaque appel est compté : c'est cette mesure qui dira quand plus aucune page publiée
     * n'en dépend, et donc quand la route peut être retirée sans casse. Un compteur, et non un
     * log par appel — cette route peut servir des milliers d'images par heure.
     *
     * @deprecated Identifiant séquentiel et donc énumérable (audit P1-06).
     */
    @Deprecated(since = "2026-07-26")
    @GetMapping("/{id}")
    public ResponseEntity<byte[]> serve(@PathVariable Long id) {
        compterAppelHerite();
        return respond(service.serve(id));
    }

    /**
     * Comptabilise l'appel et journalise le total au plus une fois par heure.
     *
     * <p>C'est cette mesure qui dira quand la route peut etre retiree sans casse : un total
     * qui reste a zero sur plusieurs jours, apres republication des pages, est la seule
     * preuve acceptable. Tant qu'il augmente, retirer la route casserait des images sur des
     * sites en production.
     */
    private static void compterAppelHerite() {
        long total = APPELS_ROUTE_HERITEE.incrementAndGet();
        long maintenant = System.currentTimeMillis();
        long precedent = DERNIER_RELEVE.get();
        if (maintenant - precedent >= INTERVALLE_RELEVE_MS
                && DERNIER_RELEVE.compareAndSet(precedent, maintenant)) {
            log.info("MEDIA/P1-06 : route heritee par identifiant appelee {} fois depuis le "
                    + "demarrage. Elle ne pourra etre retiree que lorsque ce total cessera "
                    + "d'augmenter — republier les pages des sites d'ici la.", total);
        }
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
