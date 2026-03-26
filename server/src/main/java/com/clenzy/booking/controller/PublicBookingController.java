package com.clenzy.booking.controller;

import com.clenzy.booking.dto.*;
import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.service.BookingServiceOptionsService;
import com.clenzy.booking.service.PublicBookingService;
import com.clenzy.booking.service.PublicBookingService.OrgContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * API publique du Booking Engine.
 * Base path : /api/public/booking/{slug}
 * Chemin autorisé dans SecurityConfigProd.java permitAll().
 *
 * Securite :
 * - Pas de JWT — authentifie par API Key (header X-Booking-Key) via BookingApiKeyFilter
 * - CORS dynamique par organisation
 * - Rate limiting : 120 req/min lectures, 10 req/min mutations
 *
 * Le BookingApiKeyFilter stocke le config dans les attributs de la requete :
 * - "bookingConfig" : BookingEngineConfig resolu par API Key
 * - "bookingOrgId"  : Long organisation ID
 * Le controller utilise ces attributs pour eviter un double lookup en base.
 */
@RestController
@RequestMapping("/api/public/booking/{slug}")
// Acces public : gere par SecurityConfigProd.java (.requestMatchers("/api/public/**").permitAll())
public class PublicBookingController {

    private static final Logger log = LoggerFactory.getLogger(PublicBookingController.class);

    private final PublicBookingService bookingService;
    private final BookingServiceOptionsService serviceOptionsService;
    private final com.clenzy.service.PropertyPhotoService photoService;

    public PublicBookingController(PublicBookingService bookingService,
                                    BookingServiceOptionsService serviceOptionsService,
                                    com.clenzy.service.PropertyPhotoService photoService) {
        this.bookingService = bookingService;
        this.serviceOptionsService = serviceOptionsService;
        this.photoService = photoService;
    }

    // ─── Read-only endpoints ─────────────────────────────────────────────────────

    /**
     * GET /{slug}/config
     * Retourne la configuration publique (theme, devise, politiques).
     */
    @GetMapping("/config")
    public ResponseEntity<BookingEngineConfigDto> getConfig(
            @PathVariable String slug, HttpServletRequest request) {
        OrgContext ctx = resolveContext(slug, request);
        return ResponseEntity.ok(bookingService.getConfig(ctx));
    }

    /**
     * GET /{slug}/properties
     * Liste les proprietes visibles dans le Booking Engine.
     */
    @GetMapping("/properties")
    public ResponseEntity<List<PublicPropertyDto>> getProperties(
            @PathVariable String slug, HttpServletRequest request) {
        OrgContext ctx = resolveContext(slug, request);
        return ResponseEntity.ok(bookingService.getProperties(ctx));
    }

    /**
     * GET /{slug}/properties/{id}
     * Detail d'une propriete (photos, amenities, description).
     */
    @GetMapping("/properties/{id}")
    public ResponseEntity<PublicPropertyDetailDto> getProperty(
            @PathVariable String slug,
            @PathVariable Long id,
            HttpServletRequest request) {
        OrgContext ctx = resolveContext(slug, request);
        return ResponseEntity.ok(bookingService.getPropertyDetail(ctx, id));
    }

    /**
     * POST /{slug}/availability
     * Verifie la disponibilite et calcule le prix detaille.
     */
    @PostMapping("/availability")
    public ResponseEntity<AvailabilityResponseDto> checkAvailability(
            @PathVariable String slug,
            @Valid @RequestBody AvailabilityRequestDto request,
            HttpServletRequest httpRequest) {
        OrgContext ctx = resolveContext(slug, httpRequest);
        return ResponseEntity.ok(bookingService.checkAvailability(ctx, request));
    }

    // ─── Mutation endpoints ──────────────────────────────────────────────────────

    /**
     * POST /{slug}/reserve
     * Cree une reservation PENDING avec expiration 30 min.
     */
    @PostMapping("/reserve")
    public ResponseEntity<BookingReserveResponseDto> reserve(
            @PathVariable String slug,
            @Valid @RequestBody BookingReserveRequestDto request,
            HttpServletRequest httpRequest) {
        OrgContext ctx = resolveContext(slug, httpRequest);
        return ResponseEntity.ok(bookingService.reserve(ctx, request));
    }

    /**
     * POST /{slug}/checkout
     * Cree une Stripe Checkout Session et retourne l'URL de redirection.
     */
    @PostMapping("/checkout")
    public ResponseEntity<BookingCheckoutResponseDto> checkout(
            @PathVariable String slug,
            @Valid @RequestBody BookingCheckoutRequestDto request,
            HttpServletRequest httpRequest) {
        OrgContext ctx = resolveContext(slug, httpRequest);
        return ResponseEntity.ok(bookingService.checkout(ctx, request));
    }

    /**
     * GET /{slug}/booking/{code}
     * Page de confirmation post-paiement.
     */
    @GetMapping("/booking/{code}")
    public ResponseEntity<BookingConfirmationDto> getConfirmation(
            @PathVariable String slug,
            @PathVariable String code,
            HttpServletRequest request) {
        OrgContext ctx = resolveContext(slug, request);
        return ResponseEntity.ok(bookingService.getConfirmation(ctx, code));
    }

    // ─── Helper : resolution contexte ─────────────────────────────────────────────

    /**
     * Prefere le config deja resolu par le BookingApiKeyFilter (attribut "bookingConfig").
     * Fallback sur resolveOrg(slug) si le filtre n'a pas injecte le config.
     */
    private OrgContext resolveContext(String slug, HttpServletRequest request) {
        Object configAttr = request.getAttribute("bookingConfig");
        if (configAttr instanceof BookingEngineConfig filterConfig) {
            return bookingService.resolveFromFilter(filterConfig);
        }
        // Fallback (ne devrait pas arriver en production, le filtre est toujours actif)
        return bookingService.resolveOrg(slug);
    }

    // ─── Error handler ───────────────────────────────────────────────────────────

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException e) {
        log.debug("Booking Engine — requete invalide : {}", e.getMessage());
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }

    // ─── Photos endpoint ───────────────────────────────────────────────────────

    /**
     * GET /{slug}/properties/{propertyId}/photos/{photoId}/data
     * Sert le binaire d'une photo sans authentification (pour le SDK).
     * Cache 1h publique.
     */
    @GetMapping("/properties/{propertyId}/photos/{photoId}/data")
    public ResponseEntity<byte[]> getPublicPhotoData(
            @PathVariable String slug,
            @PathVariable Long propertyId,
            @PathVariable Long photoId,
            HttpServletRequest request) {
        // Valider que la propriete appartient a l'org du booking engine
        resolveContext(slug, request);
        try {
            final byte[] data = photoService.getPhotoData(propertyId, photoId);
            final String contentType = photoService.getPhotoContentType(propertyId, photoId);
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePublic())
                    .body(data);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ─── Reviews endpoints ──────────────────────────────────────────────────────

    /**
     * GET /{slug}/reviews?propertyId={id}&page=0&size=5
     * Avis publics pagines pour une propriete ou toute l'organisation.
     */
    @GetMapping("/reviews")
    public ResponseEntity<Page<PublicReviewDto>> getReviews(
            @PathVariable String slug,
            @RequestParam(required = false) Long propertyId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "5") int size,
            HttpServletRequest request) {
        OrgContext ctx = resolveContext(slug, request);
        Page<PublicReviewDto> reviews = bookingService.getPublicReviews(ctx, propertyId, PageRequest.of(page, Math.min(size, 20)));
        return ResponseEntity.ok(reviews);
    }

    /**
     * GET /{slug}/reviews/stats?propertyId={id}
     * Statistiques agregees (note moyenne, total, distribution).
     */
    @GetMapping("/reviews/stats")
    public ResponseEntity<ReviewStatsDto> getReviewStats(
            @PathVariable String slug,
            @RequestParam(required = false) Long propertyId,
            HttpServletRequest request) {
        OrgContext ctx = resolveContext(slug, request);
        ReviewStatsDto stats = bookingService.getReviewStats(ctx, propertyId);
        return ResponseEntity.ok(stats);
    }

    // ─── Service options ─────────────────────────────────────────────────────────

    /**
     * GET /{slug}/service-options
     * Liste les categories et items de services optionnels actifs.
     */
    @GetMapping("/service-options")
    public ResponseEntity<List<BookingServiceCategoryDto>> getServiceOptions(
            @PathVariable String slug,
            HttpServletRequest request) {
        OrgContext ctx = resolveContext(slug, request);
        return ResponseEntity.ok(serviceOptionsService.listActiveCategories(ctx.orgId()));
    }

    // ─── Exception handlers ──────────────────────────────────────────────────────

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handleIllegalState(IllegalStateException e) {
        log.warn("Booking Engine — conflit : {}", e.getMessage());
        return ResponseEntity.status(409).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntimeException(RuntimeException e) {
        log.error("Booking Engine — erreur interne : {}", e.getMessage(), e);
        return ResponseEntity.internalServerError().body(Map.of("error", "Erreur interne du serveur"));
    }
}
