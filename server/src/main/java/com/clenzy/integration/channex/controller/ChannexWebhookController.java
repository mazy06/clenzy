package com.clenzy.integration.channex.controller;

import com.clenzy.integration.channex.client.ChannexSignatureValidator;
import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.dto.ChannexWebhookPayload;
import com.clenzy.integration.channex.service.ChannexBookingService;
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
    private final ChannexBookingService bookingService;
    private final ObjectMapper objectMapper;
    private final ChannexMetrics metrics;

    public ChannexWebhookController(ChannexSignatureValidator signatureValidator,
                                      ChannexBookingService bookingService,
                                      ObjectMapper objectMapper,
                                      ChannexMetrics metrics) {
        this.signatureValidator = signatureValidator;
        this.bookingService = bookingService;
        this.objectMapper = objectMapper;
        this.metrics = metrics;
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
                case "booking_new" -> handleNewBooking(payload);
                case "booking_modification" -> handleModification(payload);
                case "booking_cancellation" -> handleCancellation(payload);
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

    private ResponseEntity<Map<String, Object>> handleNewBooking(ChannexWebhookPayload payload) {
        if (payload.payload() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "missing_booking_payload"));
        }
        var reservation = bookingService.handleNewBooking(payload.payload());
        return ResponseEntity.ok(Map.of(
            "status", "ok",
            "event", "booking_new",
            "reservationId", reservation.getId(),
            "confirmationCode", reservation.getConfirmationCode()
        ));
    }

    private ResponseEntity<Map<String, Object>> handleModification(ChannexWebhookPayload payload) {
        if (payload.payload() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "missing_booking_payload"));
        }
        var reservation = bookingService.handleModification(payload.payload());
        return ResponseEntity.ok(reservation
            .<Map<String, Object>>map(r -> Map.of(
                "status", "ok",
                "event", "booking_modification",
                "reservationId", (Object) r.getId()
            ))
            .orElse(Map.of("status", "not_found", "event", "booking_modification")));
    }

    private ResponseEntity<Map<String, Object>> handleCancellation(ChannexWebhookPayload payload) {
        if (payload.payload() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "missing_booking_payload"));
        }
        var reservation = bookingService.handleCancellation(payload.payload());
        return ResponseEntity.ok(reservation
            .<Map<String, Object>>map(r -> Map.of(
                "status", "ok",
                "event", "booking_cancellation",
                "reservationId", (Object) r.getId()
            ))
            .orElse(Map.of("status", "not_found", "event", "booking_cancellation")));
    }
}
