package com.clenzy.controller;

import com.clenzy.service.KeyExchangeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller public pour la verification de codes par les commercants.
 * Pas d'authentification requise — accessible via lien unique par point d'echange.
 *
 * Endpoints :
 * - GET  /api/public/key-verify/{token}?code=XXX          → verifier un code
 * - POST /api/public/key-verify/{token}/confirm            → confirmer un mouvement de cle
 */
@RestController
@RequestMapping("/api/public/key-verify")
@Tag(name = "Key Exchange Public", description = "Verification publique des codes d'echange de cles")
public class KeyExchangePublicController {

    private static final Logger log = LoggerFactory.getLogger(KeyExchangePublicController.class);

    private final KeyExchangeService keyExchangeService;

    public KeyExchangePublicController(KeyExchangeService keyExchangeService) {
        this.keyExchangeService = keyExchangeService;
    }

    @GetMapping("/{token}")
    @Operation(summary = "Verifier un code d'echange",
            description = "Le commercant verifie le code presente par le voyageur")
    public ResponseEntity<?> verifyCode(@PathVariable String token,
                                         @RequestParam String code) {
        try {
            Map<String, Object> result = keyExchangeService.verifyCodePublic(token, code);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "invalid",
                    "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Erreur verification code (token={}): {}", token, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "server_error",
                    "message", "Erreur lors de la verification"
            ));
        }
    }

    @PostMapping("/{token}/confirm")
    @Operation(summary = "Confirmer un mouvement de cle",
            description = "Le commercant confirme la remise ou la recuperation de la cle")
    public ResponseEntity<?> confirmKeyMovement(@PathVariable String token,
                                                 @RequestBody Map<String, String> body) {
        String code = body.get("code");
        String action = body.get("action"); // collected, returned, deposited

        if (code == null || action == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "missing_fields",
                    "message", "Les champs 'code' et 'action' sont requis"
            ));
        }

        try {
            keyExchangeService.confirmKeyMovement(token, code, action);
            return ResponseEntity.ok(Map.of(
                    "status", "confirmed",
                    "message", "Mouvement confirme"
            ));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "invalid",
                    "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Erreur confirmation mouvement (token={}): {}", token, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "server_error",
                    "message", "Erreur lors de la confirmation"
            ));
        }
    }
}
