package com.clenzy.booking.controller;

import com.clenzy.booking.dto.*;
import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.service.PublicBookingCalendarService;
import com.clenzy.booking.service.BookingDisplayCurrencyService;
import com.clenzy.booking.service.BookingServiceOptionsService;
import com.clenzy.booking.service.PublicBookingService;
import com.clenzy.booking.service.PublicBookingService.OrgContext;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
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
@Tag(name = "Booking Engine", description = "API publique du Booking Engine (reservation directe)")
// Acces public : gere par SecurityConfigProd.java (.requestMatchers("/api/public/**").permitAll())
public class PublicBookingController {

    private static final Logger log = LoggerFactory.getLogger(PublicBookingController.class);

    private final PublicBookingService bookingService;
    private final BookingServiceOptionsService serviceOptionsService;
    private final com.clenzy.service.PropertyPhotoService photoService;
    private final com.clenzy.booking.security.BookingPublicRateLimiter rateLimiter;
    private final BookingDisplayCurrencyService displayCurrencyService;
    private final PublicBookingCalendarService calendarService;
    private final com.clenzy.service.LeadCaptureService leadCaptureService;
    private final com.clenzy.booking.service.PublicCancellationService cancellationService;
    private final com.clenzy.booking.service.PublicReviewService reviewService;
    private final com.clenzy.booking.service.BookingBalanceService balanceService;
    private final com.clenzy.booking.service.BookingGuestAuthService guestAuthService;

    public PublicBookingController(PublicBookingService bookingService,
                                    BookingServiceOptionsService serviceOptionsService,
                                    com.clenzy.service.PropertyPhotoService photoService,
                                    com.clenzy.booking.security.BookingPublicRateLimiter rateLimiter,
                                    BookingDisplayCurrencyService displayCurrencyService,
                                    PublicBookingCalendarService calendarService,
                                    com.clenzy.service.LeadCaptureService leadCaptureService,
                                    com.clenzy.booking.service.PublicCancellationService cancellationService,
                                    com.clenzy.booking.service.PublicReviewService reviewService,
                                    com.clenzy.booking.service.BookingBalanceService balanceService,
                                    com.clenzy.booking.service.BookingGuestAuthService guestAuthService) {
        this.bookingService = bookingService;
        this.serviceOptionsService = serviceOptionsService;
        this.photoService = photoService;
        this.rateLimiter = rateLimiter;
        this.displayCurrencyService = displayCurrencyService;
        this.calendarService = calendarService;
        this.leadCaptureService = leadCaptureService;
        this.cancellationService = cancellationService;
        this.reviewService = reviewService;
        this.balanceService = balanceService;
        this.guestAuthService = guestAuthService;
    }

    /**
     * Tarif membre (2.8) : un voyageur connecté présente son token guest (Authorization: Bearer).
     * On valide le token (Keycloak) → membre. Validé côté serveur (jamais un flag client). Best-effort :
     * un token invalide/absent ⇒ non-membre (tarif public). Appelé sur le devis + reserve (autoritatif).
     */
    private boolean resolveMember(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header == null || !header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return false;
        }
        try {
            return guestAuthService.resolveGuestKeycloakId(header.substring(7).trim()) != null;
        } catch (RuntimeException e) {
            return false; // Keycloak indisponible / token invalide → tarif public (jamais bloquant)
        }
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
            @PathVariable String slug,
            @RequestParam(required = false) String currency,
            HttpServletRequest request) {
        OrgContext ctx = resolveContext(slug, request);
        List<PublicPropertyDto> props = bookingService.getProperties(ctx);
        return ResponseEntity.ok(displayCurrencyService.convertProperties(props, currency, java.time.LocalDate.now()));
    }

    /**
     * GET /{slug}/currencies
     * Devises d'affichage disponibles (multi-devise). La conversion est indicative ;
     * le débit s'effectue dans la devise de la propriété.
     */
    @GetMapping("/currencies")
    public ResponseEntity<java.util.Set<String>> getSupportedCurrencies(@PathVariable String slug) {
        return ResponseEntity.ok(displayCurrencyService.supportedCurrencies());
    }

    /**
     * POST /{slug}/leads
     * Capture un lead (newsletter / waitlist / exit-intent) avec consentement RGPD obligatoire.
     */
    @PostMapping("/leads")
    public ResponseEntity<com.clenzy.dto.MarketingContactDto> captureLead(
            @PathVariable String slug,
            @Valid @RequestBody com.clenzy.dto.CaptureLeadRequest request,
            HttpServletRequest httpRequest) {
        OrgContext ctx = resolveContext(slug, httpRequest);
        return ResponseEntity.ok(leadCaptureService.capture(
            ctx.orgId(), request.email(), request.name(), request.source(), request.locale(), request.consent()));
    }

    /**
     * GET /{slug}/properties/{id}
     * Detail d'une propriete (photos, amenities, description).
     */
    @GetMapping("/properties/{id}")
    public ResponseEntity<PublicPropertyDetailDto> getProperty(
            @PathVariable String slug,
            @PathVariable Long id,
            @RequestParam(required = false) String currency,
            HttpServletRequest request) {
        OrgContext ctx = resolveContext(slug, request);
        PublicPropertyDetailDto detail = bookingService.getPropertyDetail(ctx, id);
        return ResponseEntity.ok(displayCurrencyService.convertDetail(detail, currency, java.time.LocalDate.now()));
    }

    /**
     * GET /{slug}/properties/{id}/calendar?month=YYYY-MM&months=2&currency=MAD
     * Grille de calendrier (disponibilité + prix nuitée + min-nights) pour la sélection de dates.
     */
    @GetMapping("/properties/{id}/calendar")
    public ResponseEntity<PropertyCalendarDto> getPropertyCalendar(
            @PathVariable String slug,
            @PathVariable Long id,
            @RequestParam(required = false) String month,
            @RequestParam(defaultValue = "2") int months,
            @RequestParam(required = false) String currency,
            HttpServletRequest request) {
        OrgContext ctx = resolveContext(slug, request);
        java.time.YearMonth ym;
        try {
            ym = (month != null && !month.isBlank()) ? java.time.YearMonth.parse(month) : java.time.YearMonth.now();
        } catch (java.time.format.DateTimeParseException e) {
            throw new IllegalArgumentException("Parametre 'month' invalide (attendu YYYY-MM)");
        }
        PropertyCalendarDto calendar = calendarService.getCalendar(ctx, id, ym, months);
        return ResponseEntity.ok(displayCurrencyService.convertCalendar(calendar, currency, java.time.LocalDate.now()));
    }

    /**
     * POST /{slug}/availability
     * Verifie la disponibilite et calcule le prix detaille.
     */
    @PostMapping("/availability")
    public ResponseEntity<AvailabilityResponseDto> checkAvailability(
            @PathVariable String slug,
            @RequestParam(required = false) String currency,
            @Valid @RequestBody AvailabilityRequestDto request,
            HttpServletRequest httpRequest) {
        OrgContext ctx = resolveContext(slug, httpRequest);
        AvailabilityResponseDto resp = bookingService.checkAvailability(ctx, request, resolveMember(httpRequest));
        java.time.LocalDate rateDate = resp.checkIn() != null ? resp.checkIn() : java.time.LocalDate.now();
        return ResponseEntity.ok(displayCurrencyService.convertAvailability(resp, currency, rateDate));
    }

    // ─── Mutation endpoints ──────────────────────────────────────────────────────

    /**
     * POST /{slug}/reserve
     * Cree une reservation PENDING avec expiration 30 min.
     *
     * <p>Rate-limit Redis IP+propriete (reliquat revue A3) : chaque appel cree un
     * hold qui gele les dates 30 min — sans limite, DoS du calendrier.</p>
     */
    @PostMapping("/reserve")
    public ResponseEntity<?> reserve(
            @PathVariable String slug,
            @Valid @RequestBody BookingReserveRequestDto request,
            HttpServletRequest httpRequest) {
        if (!rateLimiter.tryAcquireHold(httpRequest, request.propertyId())) {
            return tooManyReservationAttempts();
        }
        OrgContext ctx = resolveContext(slug, httpRequest);
        return ResponseEntity.ok(bookingService.reserve(ctx, request, resolveMember(httpRequest)));
    }

    /**
     * POST /{slug}/reserve-batch
     * Cree un panier de N reservations PENDING en une seule transaction atomique.
     *
     * <p>Utile pour les sejours multiples (panier avec plusieurs proprietes ou plusieurs
     * creneaux). Si un seul item n'est pas disponible, toute l'operation est rollback.</p>
     *
     * <p>Le guest est partage entre tous les items. Rate-limit par IP (un batch
     * peut creer jusqu'a 20 holds d'un coup).</p>
     */
    @PostMapping("/reserve-batch")
    public ResponseEntity<?> reserveBatch(
            @PathVariable String slug,
            @Valid @RequestBody BookingReserveBatchRequestDto request,
            HttpServletRequest httpRequest) {
        if (!rateLimiter.tryAcquireBatch(httpRequest)) {
            return tooManyReservationAttempts();
        }
        OrgContext ctx = resolveContext(slug, httpRequest);
        return ResponseEntity.ok(bookingService.reserveBatch(ctx, request, resolveMember(httpRequest)));
    }

    private ResponseEntity<Map<String, String>> tooManyReservationAttempts() {
        return ResponseEntity.status(429)
            .body(Map.of("error", "Trop de tentatives de reservation, reessayez plus tard"));
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

    /**
     * POST /{slug}/booking/{code}/cancellation-preview
     * Aperçu self-service du remboursement applicable (politique d'annulation), sans annuler.
     * Auth : code de confirmation + email guest (corps). Rate-limité par IP.
     */
    @PostMapping("/booking/{code}/cancellation-preview")
    public ResponseEntity<?> cancellationPreview(
            @PathVariable String slug,
            @PathVariable String code,
            @Valid @RequestBody com.clenzy.booking.dto.BookingCancellationRequest request,
            HttpServletRequest httpRequest) {
        if (!rateLimiter.tryAcquirePreview(httpRequest)) {
            return tooManyReservationAttempts();
        }
        OrgContext ctx = resolveContext(slug, httpRequest);
        return ResponseEntity.ok(cancellationService.preview(ctx.orgId(), code, request.email()));
    }

    /**
     * POST /{slug}/booking/{code}/cancel
     * Annulation self-service : libère le calendrier + émet le remboursement applicable (politique).
     * Auth : code de confirmation + email guest. Rate-limité par IP. Idempotent.
     */
    @PostMapping("/booking/{code}/cancel")
    public ResponseEntity<?> cancelBooking(
            @PathVariable String slug,
            @PathVariable String code,
            @Valid @RequestBody com.clenzy.booking.dto.BookingCancellationRequest request,
            HttpServletRequest httpRequest) {
        if (!rateLimiter.tryAcquirePreview(httpRequest)) {
            return tooManyReservationAttempts();
        }
        OrgContext ctx = resolveContext(slug, httpRequest);
        return ResponseEntity.ok(cancellationService.cancel(ctx.orgId(), code, request.email(), request.reason()));
    }

    /**
     * POST /{slug}/booking/{code}/pay-balance
     * Crée la session Stripe Checkout pour régler le SOLDE d'un acompte (P0.7) et renvoie son URL.
     * Org-scopé (X-Booking-Key). Rate-limité par IP.
     */
    @PostMapping("/booking/{code}/pay-balance")
    public ResponseEntity<?> payBalance(
            @PathVariable String slug,
            @PathVariable String code,
            HttpServletRequest httpRequest) {
        if (!rateLimiter.tryAcquirePreview(httpRequest)) {
            return tooManyReservationAttempts();
        }
        OrgContext ctx = resolveContext(slug, httpRequest);
        try {
            String checkoutUrl = balanceService.createBalanceCheckoutUrl(ctx.orgId(), code);
            return ResponseEntity.ok(Map.of("checkoutUrl", checkoutUrl));
        } catch (com.clenzy.exception.NotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Booking Engine: erreur création paiement du solde {} : {}", code, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("error", "Erreur lors de la création du paiement"));
        }
    }

    /**
     * GET /{slug}/reviews/summary?limit=6
     * Avis publics agrégés (org) + avis récents — preuve sociale sur la page publique.
     * (Distinct de GET /reviews paginé par propriété pour éviter l'ambiguïté de mapping.)
     */
    @GetMapping("/reviews/summary")
    public ResponseEntity<com.clenzy.booking.dto.PublicReviewsResponse> getReviewsSummary(
            @PathVariable String slug,
            @RequestParam(required = false, defaultValue = "6") int limit,
            HttpServletRequest request) {
        OrgContext ctx = resolveContext(slug, request);
        return ResponseEntity.ok(reviewService.getReviews(ctx.orgId(), limit));
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
