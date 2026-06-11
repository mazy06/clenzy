package com.clenzy.controller;

import com.clenzy.service.messaging.whatsapp.OpenWaSessionService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Endpoints frontend pour le flow de scan QR OpenWA (compte WhatsApp GLOBAL,
 * session unique {@code clenzy-global}). Toute la logique (appels HTTP OpenWA,
 * persistence de la config, webhook entrant) vit dans
 * {@link OpenWaSessionService} — le controller mappe uniquement les issues
 * vers les codes HTTP/messages attendus par le frontend.
 *
 * <h3>Sécurité</h3>
 * Opération PLATEFORME : {@code hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')}.
 */
@RestController
@RequestMapping("/api/whatsapp/openwa")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class OpenWaSessionController {

    private final OpenWaSessionService sessionService;

    public OpenWaSessionController(OpenWaSessionService sessionService) {
        this.sessionService = sessionService;
    }

    // ─── POST /session : crée (ou réutilise) + démarre la session OpenWA ────

    @PostMapping("/session")
    public ResponseEntity<Map<String, Object>> createSession() {
        OpenWaSessionService.SessionCreation result = sessionService.createSession();
        return switch (result.outcome()) {
            case MISSING_MASTER_KEY -> ResponseEntity.status(400).body(Map.of(
                "error", "Master key OpenWA non configurée. Saisissez-la dans la configuration et enregistrez d'abord."));
            case UNREACHABLE -> ResponseEntity.status(503).body(Map.of(
                "error", "Instance OpenWA injoignable ou master key invalide",
                "details", "Verifier que le container openwa est demarre et la master key correcte."));
            case READY -> ResponseEntity.ok(Map.of("sessionId", result.sessionId(), "status", "qr_pending"));
        };
    }

    // ─── GET /qr : récupère l'image QR depuis OpenWA ───────────────────────

    @GetMapping("/qr")
    public ResponseEntity<Map<String, Object>> getQr() {
        OpenWaSessionService.QrFetch result = sessionService.fetchQr();
        return switch (result.outcome()) {
            case NOT_CONFIGURED -> ResponseEntity.status(404).body(Map.of(
                "error", "Aucune session OpenWA active. Cliquez sur 'Scanner le QR code'."));
            case NOT_AVAILABLE -> ResponseEntity.status(404).body(Map.of(
                "error", "QR code non disponible (session déjà connectée ?)"));
            case UNREACHABLE -> ResponseEntity.status(503).body(Map.of(
                "error", "Instance OpenWA injoignable ou QR pas prêt"));
            case OK -> ResponseEntity.ok(Map.of("qr", result.qr(), "sessionId", result.sessionId()));
        };
    }

    // ─── GET /status : polling du statut de connexion ──────────────────────

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        OpenWaSessionService.ConnectionStatus status = sessionService.fetchStatus();
        Map<String, Object> result = new HashMap<>();
        result.put("status", status.status());
        if (status.sessionId() != null) result.put("sessionId", status.sessionId());
        if (status.phoneNumber() != null) result.put("phoneNumber", status.phoneNumber());
        return ResponseEntity.ok(result);
    }

    // ─── DELETE /session : détruit la session OpenWA + reset l'id ──────────

    @DeleteMapping("/session")
    public ResponseEntity<Void> deleteSession() {
        sessionService.deleteSession();
        return ResponseEntity.noContent().build();
    }
}
