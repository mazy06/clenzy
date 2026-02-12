package com.clenzy.controller;

import com.clenzy.dto.InscriptionDto;
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
     * et retourne l'URL de redirection vers Stripe.
     *
     * POST /api/public/inscription
     * Body: InscriptionDto (fullName, email, password, forfait, etc.)
     * Response: { checkoutUrl: "https://checkout.stripe.com/...", sessionId: "cs_..." }
     */
    @PostMapping
    public ResponseEntity<?> register(@Valid @RequestBody InscriptionDto dto) {
        try {
            logger.info("Demande d'inscription recue pour: {}", dto.getEmail());

            Map<String, String> result = inscriptionService.initiateInscription(dto);

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
}
