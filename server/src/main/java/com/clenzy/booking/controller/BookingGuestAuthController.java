package com.clenzy.booking.controller;

import com.clenzy.booking.dto.*;
import com.clenzy.booking.service.BookingGuestAuthService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import org.springframework.security.access.prepost.PreAuthorize;

import java.util.Map;

/**
 * Authentification des guests du booking engine.
 * Endpoints publics (pas de JWT requis) — les guests n'ont pas encore de token.
 * Chemin autorisé dans SecurityConfigProd.java permitAll().
 * Sécurisé par rate limiting (à configurer) et validation des inputs.
 */
@RestController
@RequestMapping("/api/booking-engine/auth")
// Acces public : gere par SecurityConfigProd.java (.requestMatchers("/api/booking-engine/auth/**").permitAll())
public class BookingGuestAuthController {

    private static final Logger log = LoggerFactory.getLogger(BookingGuestAuthController.class);

    private final BookingGuestAuthService authService;

    public BookingGuestAuthController(BookingGuestAuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody GuestRegisterRequest request) {
        try {
            GuestAuthResponse response = authService.register(request);
            log.info("Guest inscrit: email={}, org={}", request.email(), request.organizationId());
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Erreur inscription guest: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Erreur lors de l'inscription"));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody GuestLoginRequest request) {
        try {
            GuestAuthResponse response = authService.login(request);
            log.info("Guest connecté: email={}, org={}", request.email(), request.organizationId());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Erreur login guest: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Erreur lors de la connexion"));
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestBody Map<String, Object> body) {
        try {
            String refreshToken = (String) body.get("refreshToken");
            Long orgId = body.get("organizationId") instanceof Number n ? n.longValue() : null;
            String keycloakId = (String) body.get("keycloakId");

            if (refreshToken == null || orgId == null || keycloakId == null) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "refreshToken, organizationId et keycloakId requis"));
            }

            GuestAuthResponse response = authService.refreshToken(refreshToken, orgId, keycloakId);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Erreur refresh guest: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Erreur lors du rafraîchissement"));
        }
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, Object> body) {
        try {
            String email = (String) body.get("email");
            Long orgId = body.get("organizationId") instanceof Number n ? n.longValue() : null;

            if (email == null || email.isBlank() || orgId == null) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "Email et organizationId requis"));
            }

            authService.sendPasswordResetEmail(email, orgId);
            log.info("Reset password demandé pour email={}, org={}", email, orgId);
            return ResponseEntity.ok(Map.of("message", "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé."));
        } catch (Exception e) {
            log.error("Erreur forgot-password: {}", e.getMessage(), e);
            // On retourne toujours OK pour ne pas révéler l'existence d'un compte
            return ResponseEntity.ok(Map.of("message", "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé."));
        }
    }
}
