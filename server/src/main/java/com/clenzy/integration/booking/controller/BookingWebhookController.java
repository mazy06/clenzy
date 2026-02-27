package com.clenzy.integration.booking.controller;

import com.clenzy.integration.booking.dto.BookingWebhookPayload;
import com.clenzy.integration.booking.model.BookingConnection;
import com.clenzy.integration.booking.repository.BookingConnectionRepository;
import com.clenzy.integration.booking.service.BookingWebhookService;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller pour les webhooks Booking.com.
 *
 * Endpoint public (pas d'authentification JWT) car Booking.com envoie
 * les evenements directement. La securite est assuree par :
 * - Validation de la signature HMAC dans le header
 * - Rate limiting au niveau Nginx
 *
 * IMPORTANT : Repondre 200 OK le plus vite possible
 * pour eviter les retries de Booking.com. Le traitement reel est
 * asynchrone via Kafka.
 */
@RestController
@RequestMapping("/api/webhooks/booking")
@Tag(name = "Booking.com Webhooks", description = "Reception des evenements Booking.com")
public class BookingWebhookController {

    private static final Logger log = LoggerFactory.getLogger(BookingWebhookController.class);

    private final BookingWebhookService webhookService;
    private final BookingConnectionRepository connectionRepository;
    private final ObjectMapper objectMapper;

    public BookingWebhookController(BookingWebhookService webhookService,
                                    BookingConnectionRepository connectionRepository,
                                    ObjectMapper objectMapper) {
        this.webhookService = webhookService;
        this.connectionRepository = connectionRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * Endpoint webhook Booking.com.
     * Recoit les evenements (reservations, calendrier, tarifs).
     *
     * Header attendu : X-Booking-Signature (HMAC-SHA256 du body)
     */
    @PostMapping
    @Operation(summary = "Webhook Booking.com",
            description = "Recoit les evenements Booking.com (public, securise par signature HMAC)")
    public ResponseEntity<Map<String, String>> receiveWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "X-Booking-Signature", required = false) String signature) {

        log.debug("Webhook Booking.com recu ({} bytes)", payload != null ? payload.length() : 0);

        // 1. Valider la signature
        if (!webhookService.validateWebhookSignature(signature, payload)) {
            log.warn("Signature webhook Booking.com invalide");
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "Invalid webhook signature"
            ));
        }

        try {
            // 2. Parser le payload
            BookingWebhookPayload webhookPayload = objectMapper.readValue(payload, BookingWebhookPayload.class);

            // 3. Resoudre l'orgId depuis le hotelId
            Long orgId = resolveOrgId(webhookPayload.hotelId());

            // 4. Deleguer au service (publication Kafka asynchrone)
            webhookService.processWebhook(webhookPayload, orgId);

            return ResponseEntity.ok(Map.of(
                    "status", "ok",
                    "message", "Event received"
            ));

        } catch (Exception e) {
            log.error("Erreur parsing webhook Booking.com: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "Invalid webhook payload"
            ));
        }
    }

    /**
     * Resout l'organizationId depuis un hotelId Booking.com.
     */
    private Long resolveOrgId(String hotelId) {
        if (hotelId == null) return null;
        return connectionRepository.findByHotelId(hotelId)
                .map(BookingConnection::getOrganizationId)
                .orElse(null);
    }
}
