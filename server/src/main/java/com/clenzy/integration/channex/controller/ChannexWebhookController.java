package com.clenzy.integration.channex.controller;

import com.clenzy.integration.channex.client.ChannexSignatureValidator;
import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.dto.ChannexWebhookPayload;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Webhook handler Channex.
 *
 * <p><b>Endpoint :</b> {@code POST /api/webhooks/channex}</p>
 *
 * <p><b>Securite :</b> validation par token statique partage envoye dans le
 * header {@code X-Channex-Token}, configure cote Channex dashboard (Settings →
 * Webhooks → Headers). Endpoint dans {@code permitAll()} cote Spring Security
 * (auth = token, pas JWT). Doit etre dans la whitelist de
 * {@code SecurityConfigProd.java}.</p>
 *
 * <p><b>Events supportes :</b></p>
 * <ul>
 *   <li>{@code booking_new} → cree une Reservation</li>
 *   <li>{@code booking_modification} → modifie la Reservation existante</li>
 *   <li>{@code booking_cancellation} → annule + libere le calendrier</li>
 * </ul>
 *
 * <p><b>Retour HTTP :</b></p>
 * <ul>
 *   <li>{@code 200 OK} → event traite (ou idempotent skip)</li>
 *   <li>{@code 401} → signature invalide (Channex ne re-tentera pas)</li>
 *   <li>{@code 400} → payload malforme (Channex peut re-tenter avec un payload corrige)</li>
 *   <li>{@code 500} → erreur interne — Channex re-tentera selon sa politique</li>
 * </ul>
 *
 * <p>Reference plan : {@code docs/strategy/channex-integration-plan.md} Sprint 4.</p>
 */
@RestController
@RequestMapping("/api/webhooks/channex")
public class ChannexWebhookController {

    private static final Logger log = LoggerFactory.getLogger(ChannexWebhookController.class);

    private final ChannexSignatureValidator signatureValidator;
    // Flux primaire bookings : le webhook DECLENCHE un drain du feed de revisions
    // (persist -> ack), il ne persiste plus lui-meme le payload embarque.
    private final com.clenzy.integration.channex.service.ChannexBookingFeedService bookingFeedService;
    private final ObjectMapper objectMapper;
    private final ChannexMetrics metrics;
    // Sprint A3 : flag sync errors sur mapping
    private final com.clenzy.integration.channex.service.ChannexSyncErrorService syncErrorService;
    // Item 2 + 3 (paid apps) : routing webhooks Messages + Reviews
    private final com.clenzy.integration.channex.service.ChannexMessagingService messagingService;
    // Phase B : unmapped bookings, rate_error/sync_warning, cycle de vie channel, events Airbnb
    private final com.clenzy.integration.channex.service.ChannexChannelEventService channelEventService;

    public ChannexWebhookController(ChannexSignatureValidator signatureValidator,
                                      com.clenzy.integration.channex.service.ChannexBookingFeedService bookingFeedService,
                                      ObjectMapper objectMapper,
                                      ChannexMetrics metrics,
                                      com.clenzy.integration.channex.service.ChannexSyncErrorService syncErrorService,
                                      com.clenzy.integration.channex.service.ChannexMessagingService messagingService,
                                      com.clenzy.integration.channex.service.ChannexChannelEventService channelEventService) {
        this.signatureValidator = signatureValidator;
        this.bookingFeedService = bookingFeedService;
        this.objectMapper = objectMapper;
        this.metrics = metrics;
        this.syncErrorService = syncErrorService;
        this.messagingService = messagingService;
        this.channelEventService = channelEventService;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> handleWebhook(
            @RequestHeader(value = "X-Channex-Token", required = false) String token,
            @RequestBody String rawBody) {

        // 1. Validation token (anti spoof) — header statique partage configure dans Channex dashboard
        if (!signatureValidator.isValid(token)) {
            log.warn("Channex webhook: token invalide refuse (body length {})", rawBody.length());
            metrics.recordWebhookReceived("unknown", "invalid_signature");
            return ResponseEntity.status(401).body(Map.of(
                "error", "invalid_token",
                "message", "X-Channex-Token header missing or invalid"
            ));
        }

        // 2. Parsing
        ChannexWebhookPayload payload;
        try {
            payload = objectMapper.readValue(rawBody, ChannexWebhookPayload.class);
        } catch (Exception e) {
            log.error("Channex webhook: payload malforme: {}", e.getMessage());
            metrics.recordWebhookReceived("unknown", "malformed");
            return ResponseEntity.badRequest().body(Map.of(
                "error", "malformed_payload",
                "message", e.getMessage()
            ));
        }

        if (payload.event() == null) {
            log.warn("Channex webhook: event type manquant dans le payload");
            metrics.recordWebhookReceived("unknown", "malformed");
            return ResponseEntity.badRequest().body(Map.of("error", "missing_event"));
        }

        log.info("Channex webhook recu: event={} property_id={} booking_id={}",
            payload.event(),
            payload.propertyId(),
            payload.payload() != null ? payload.payload().id() : "n/a");

        // 3. Dispatch
        try {
            ResponseEntity<Map<String, Object>> response = switch (payload.event()) {
                // Doc Channex : les webhooks booking sont des DECLENCHEURS. La source
                // de verite est le feed de revisions (persist -> ack par revision) —
                // couvre aussi le desordre de livraison et les webhooks manques.
                case "booking_new", "booking_modification", "booking_cancellation",
                     "non_acked_booking", "booking" -> handleBookingTrigger(payload);
                // Sprint A3 (Quick Win) — Channex notifie qu'un push availability/rates
                // a echoue cote OTA. On flag le mapping en ERROR avec le detail.
                case "sync_error" -> handleSyncError(payload);
                // Phase B — resa sur room/rate NON mappe (priorite doc : risque de
                // double reservation). On notifie ET on draine le feed (la revision
                // doit quand meme etre persistee — le mapping Clenzy se resout par
                // propriete, room_type_id null n'empeche pas la creation).
                case "booking_unmapped_room", "booking_unmapped_rate" ->
                    handleUnmappedBooking(payload);
                // Phase B — tarifs rejetes par l'OTA / avertissement non bloquant
                case "rate_error" -> handleChannelEvent(payload,
                    () -> channelEventService.onRateError(payload.propertyId(), null));
                case "sync_warning" -> handleChannelEvent(payload,
                    () -> channelEventService.onSyncWarning(payload.propertyId(), null));
                // Phase B — cycle de vie des canaux OTA (une deconnexion stoppe la
                // distribution sans aucun autre signal cote PMS)
                case "new_channel", "updated_channel", "activate_channel",
                     "deactivate_channel", "disconnect_channel", "disconnect_listing" ->
                    handleChannelEvent(payload,
                        () -> channelEventService.onChannelLifecycleEvent(
                            payload.propertyId(), payload.event()));
                // Phase B — evenements Airbnb (l'action se fait dans l'ecran Channex)
                case "reservation_request", "alteration_request", "inquiry",
                     "accepted_reservation", "declined_reservation" ->
                    handleChannelEvent(payload,
                        () -> channelEventService.onAirbnbEvent(
                            payload.propertyId(), payload.event()));
                // Item 2 (Messages App) — nouveau message guest OTA recu via Channex
                case "message" -> handleChannexMessage(rawBody);
                // Item 3 (Reviews App) — nouvelle review ou mise a jour
                case "review", "updated_review" -> handleChannexReview(rawBody);
                default -> {
                    log.debug("Channex webhook: event '{}' ignore (non gere)", payload.event());
                    metrics.recordWebhookReceived(payload.event(), "ignored");
                    yield ResponseEntity.ok(Map.of("status", "ignored", "event", payload.event()));
                }
            };
            metrics.recordWebhookReceived(payload.event(), "ok");
            return response;
        } catch (IllegalStateException | IllegalArgumentException e) {
            // Erreur metier (mapping absent, payload invalide) — 400 pour signaler a Channex de ne pas retry
            log.error("Channex webhook: erreur metier: {}", e.getMessage());
            metrics.recordWebhookReceived(payload.event(), "business_error");
            return ResponseEntity.badRequest().body(Map.of(
                "error", "business_error",
                "message", e.getMessage()
            ));
        } catch (Exception e) {
            // Erreur technique imprevue — 500 pour que Channex retry
            log.error("Channex webhook: erreur technique non-recuperee", e);
            metrics.recordWebhookReceived(payload.event(), "technical_error");
            return ResponseEntity.internalServerError().body(Map.of(
                "error", "internal_error",
                "message", "Voir les logs Clenzy pour le detail"
            ));
        }
    }

    // ─── Dispatchers ────────────────────────────────────────────────────────

    /**
     * Trigger unique pour tous les evenements booking ({@code booking_new},
     * {@code booking_modification}, {@code booking_cancellation},
     * {@code non_acked_booking}, {@code booking}) : draine le feed de revisions
     * non acquittees (persist → ack par revision).
     *
     * <p>Le payload embarque dans le webhook n'est plus la source de verite
     * (doc Channex : ordre non garanti) — la revision concernee est dans le
     * feed tant qu'elle n'est pas ackee, le drain la traite donc forcement.
     * Reponse 200 systematique si le drain a tourne : les echecs partiels
     * restent dans le feed et sont re-tentes (webhook suivant ou scheduler),
     * inutile que Channex re-livre le webhook.</p>
     */
    private ResponseEntity<Map<String, Object>> handleBookingTrigger(ChannexWebhookPayload payload) {
        var result = bookingFeedService.processFeed();
        return ResponseEntity.ok(Map.of(
            "status", "ok",
            "event", payload.event(),
            "revisionsProcessed", result.processed(),
            "revisionsAcked", result.acked(),
            "revisionsFailed", result.failed()
        ));
    }

    /**
     * Phase B — resa sur room/rate non mappe : notification + sync log (via
     * ChannexChannelEventService) PUIS drain du feed (la revision est
     * persistee malgre le room_type_id null — resolution par propriete).
     */
    private ResponseEntity<Map<String, Object>> handleUnmappedBooking(ChannexWebhookPayload payload) {
        boolean notified = channelEventService.onUnmappedBooking(
            payload.propertyId(), payload.event());
        var result = bookingFeedService.processFeed();
        return ResponseEntity.ok(Map.of(
            "status", "ok",
            "event", payload.event(),
            "notified", notified,
            "revisionsProcessed", result.processed(),
            "revisionsAcked", result.acked()
        ));
    }

    /**
     * Phase B — handler generique des evenements de canal : delegue au service
     * (notification + logs), repond 200 dans tous les cas (mapping absent =
     * ignored, inutile que Channex re-livre).
     */
    private ResponseEntity<Map<String, Object>> handleChannelEvent(
            ChannexWebhookPayload payload, java.util.function.BooleanSupplier action) {
        boolean handled = action.getAsBoolean();
        return ResponseEntity.ok(Map.of(
            "status", handled ? "ok" : "ignored",
            "event", payload.event(),
            handled ? "action" : "reason", handled ? "notified" : "no_mapping"
        ));
    }

    /**
     * Item 2 (Messages App) — Channex notifie un nouveau message guest OTA.
     * On persiste dans la table conversations Clenzy existante (channel=AIRBNB/BOOKING)
     * pour que l'UI ChannelInboxTab le voie transparently.
     */
    private ResponseEntity<Map<String, Object>> handleChannexMessage(String rawBody) {
        try {
            // Parse en JsonNode pour eviter de typer un nouveau payload (Channex envoie
            // {event, payload: {thread_id, message, ...}}).
            com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(rawBody);
            com.fasterxml.jackson.databind.JsonNode messagePayload = root.path("payload");
            var saved = messagingService.onChannexMessage(messagePayload);
            return ResponseEntity.ok(Map.of(
                "status", "ok",
                "event", "message",
                "persisted", saved.isPresent()
            ));
        } catch (Exception e) {
            log.warn("Channex webhook[message]: parse KO: {}", e.getMessage());
            return ResponseEntity.ok(Map.of("status", "ignored", "error", e.getMessage()));
        }
    }

    /**
     * Item 3 (Reviews App) — Channex notifie une nouvelle review ou un update.
     * Pour l'instant on log + return 200. La persistance Reviews est faite par
     * le scheduler periodique (Phase 3 reviews) qui pull les data.
     */
    private ResponseEntity<Map<String, Object>> handleChannexReview(String rawBody) {
        try {
            com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(rawBody);
            com.fasterxml.jackson.databind.JsonNode reviewPayload = root.path("payload");
            String reviewId = reviewPayload.path("id").asText("?");
            String channel = reviewPayload.path("channel").asText("?");
            log.info("Channex webhook[review]: review_id={} channel={} (TODO persist via ChannexReviewsService)",
                reviewId, channel);
            return ResponseEntity.ok(Map.of(
                "status", "ok",
                "event", "review",
                "reviewId", reviewId
            ));
        } catch (Exception e) {
            log.warn("Channex webhook[review]: parse KO: {}", e.getMessage());
            return ResponseEntity.ok(Map.of("status", "ignored", "error", e.getMessage()));
        }
    }

    /**
     * Sprint A3 — Channex notifie qu'un push availability/rates a echoue cote OTA.
     * On met a jour le {@code mapping.lastSyncError} + on enregistre un sync_log
     * FAIL pour que l'admin voie le detail dans le diagnose dialog.
     */
    private ResponseEntity<Map<String, Object>> handleSyncError(ChannexWebhookPayload payload) {
        // Le payload sync_error a une structure custom (pas booking). On extrait
        // l'identite de la property + un message generique. Le detail de l'erreur
        // sera consultable dans /channels/{id}/logs (Sprint A4) cote UI Channex.
        String channexPropertyId = payload.propertyId();
        String errorMessage = "OTA sync error notified by Channex (voir channel logs pour le detail)";
        if (channexPropertyId == null || channexPropertyId.isBlank()) {
            log.warn("Channex webhook[sync_error]: pas de property_id, ignore");
            return ResponseEntity.ok(Map.of("status", "ignored", "reason", "no_property_id"));
        }
        // Tenant-agnostic lookup (sync_error arrive sans tenant context)
        var mappingOpt = syncErrorService.findMappingAnyOrg(channexPropertyId);
        if (mappingOpt.isEmpty()) {
            log.warn("Channex webhook[sync_error]: mapping introuvable pour property={}", channexPropertyId);
            return ResponseEntity.ok(Map.of("status", "ignored", "reason", "no_mapping"));
        }
        var mapping = mappingOpt.get();
        try {
            // Flag ERROR + sync log FAIL pour l'historique consultable dans le diagnose dialog
            syncErrorService.flagSyncError(mapping, errorMessage);
            log.warn("Channex webhook[sync_error]: mapping={} property={} flagged ERROR: {}",
                mapping.getId(), mapping.getClenzyPropertyId(), errorMessage);
            return ResponseEntity.ok(Map.of(
                "status", "ok",
                "event", "sync_error",
                "mappingId", mapping.getId().toString(),
                "action", "flagged_error"
            ));
        } catch (Exception e) {
            log.error("Channex webhook[sync_error]: erreur DB property={}: {}",
                channexPropertyId, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
