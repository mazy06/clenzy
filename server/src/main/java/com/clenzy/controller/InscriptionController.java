package com.clenzy.controller;

import com.clenzy.dto.InscriptionDto;
import com.clenzy.dto.SetPasswordDto;
import com.clenzy.service.InscriptionService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller public pour l'inscription des nouveaux utilisateurs.
 * Le endpoint est accessible sans authentification (/api/public/inscription).
 *
 * Endpoints :
 *   POST /api/public/inscription                    → Initier l'inscription (session Stripe)
 *   GET  /api/public/inscription/confirm-info        → Infos inscription par token
 *   POST /api/public/inscription/set-password        → Finaliser avec mot de passe (auto-login)
 *   POST /api/public/inscription/resend-confirmation → Renvoyer l'email de confirmation
 */
@RestController
@RequestMapping("/api/public/inscription")
public class InscriptionController {

    private static final Logger logger = LoggerFactory.getLogger(InscriptionController.class);

    private final InscriptionService inscriptionService;

    public InscriptionController(InscriptionService inscriptionService) {
        this.inscriptionService = inscriptionService;
    }

    /**
     * Endpoint d'inscription : valide les donnees, cree une session Stripe Checkout
     * et retourne le clientSecret pour l'Embedded Checkout.
     *
     * POST /api/public/inscription
     */
    @PostMapping
    public ResponseEntity<?> register(@Valid @RequestBody InscriptionDto dto) {
        try {
            logger.info("Demande d'inscription recue pour: {}", dto.getEmail());

            Map<String, Object> result = inscriptionService.initiateInscription(dto);

            return ResponseEntity.ok(result);

        } catch (RuntimeException e) {
            logger.warn("Erreur d'inscription pour {}: {}", dto.getEmail(), e.getMessage());
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of(
                            "error", true,
                            "message", e.getMessage()
                    ));
        } catch (Exception e) {
            logger.error("Erreur inattendue lors de l'inscription pour: {}", dto.getEmail(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "error", true,
                            "message", "Erreur lors de la creation de la session de paiement. Veuillez reessayer."
                    ));
        }
    }

    /**
     * Retourne les informations de l'inscription pour la page de confirmation.
     *
     * GET /api/public/inscription/confirm-info?token=xxx
     */
    @GetMapping("/confirm-info")
    public ResponseEntity<?> getConfirmInfo(@RequestParam String token) {
        try {
            Map<String, Object> info = inscriptionService.getInscriptionInfoByToken(token);
            return ResponseEntity.ok(info);

        } catch (IllegalStateException e) {
            if ("ALREADY_COMPLETED".equals(e.getMessage())) {
                return ResponseEntity.status(HttpStatus.GONE)
                        .body(Map.of(
                                "error", "ALREADY_COMPLETED",
                                "message", "Cette inscription a deja ete finalisee. Vous pouvez vous connecter."
                        ));
            }
            return ResponseEntity.badRequest().body(Map.of("error", true, "message", e.getMessage()));
        } catch (RuntimeException e) {
            logger.warn("Token de confirmation invalide: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of(
                            "error", true,
                            "message", e.getMessage()
                    ));
        }
    }

    /**
     * Finalise l'inscription : cree le compte avec le mot de passe et retourne les JWT tokens.
     *
     * POST /api/public/inscription/set-password
     */
    @PostMapping("/set-password")
    public ResponseEntity<?> setPassword(@Valid @RequestBody SetPasswordDto dto) {
        try {
            logger.info("Finalisation inscription avec mot de passe");

            Map<String, Object> tokens = inscriptionService.completeInscriptionWithPassword(
                    dto.getToken(), dto.getPassword());

            return ResponseEntity.ok(tokens);

        } catch (RuntimeException e) {
            logger.warn("Erreur lors de la finalisation: {}", e.getMessage());

            // Determiner le code HTTP selon le type d'erreur
            HttpStatus status = HttpStatus.BAD_REQUEST;
            if (e.getMessage() != null) {
                if (e.getMessage().contains("invalide") || e.getMessage().contains("expire")) {
                    status = HttpStatus.NOT_FOUND;
                } else if (e.getMessage().contains("deja ete finalisee")) {
                    status = HttpStatus.GONE;
                }
            }

            return ResponseEntity.status(status)
                    .body(Map.of(
                            "error", true,
                            "message", e.getMessage()
                    ));
        }
    }

    /**
     * Renvoie l'email de confirmation.
     *
     * POST /api/public/inscription/resend-confirmation
     */
    @PostMapping("/resend-confirmation")
    public ResponseEntity<?> resendConfirmation(@RequestBody Map<String, String> body) {
        try {
            String email = body.get("email");
            if (email == null || email.isBlank()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", true, "message", "L'email est requis."));
            }

            inscriptionService.resendConfirmationEmail(email);

            return ResponseEntity.ok(Map.of("success", true, "message", "Email de confirmation renvoye."));

        } catch (RuntimeException e) {
            logger.warn("Erreur renvoi confirmation: {}", e.getMessage());
            // Message generique pour ne pas reveler si l'email existe
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Si une inscription est en attente pour cet email, un nouveau lien a ete envoye."
            ));
        }
    }
}
