package com.clenzy.controller;

import com.clenzy.dto.PaymentSessionRequest;
import com.clenzy.dto.PaymentSessionResponse;
import com.clenzy.model.Intervention;
import com.clenzy.model.PaymentStatus;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.service.StripeService;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {
    
    private final StripeService stripeService;
    private final InterventionRepository interventionRepository;
    
    @Autowired
    public PaymentController(StripeService stripeService, InterventionRepository interventionRepository) {
        this.stripeService = stripeService;
        this.interventionRepository = interventionRepository;
    }
    
    /**
     * Crée une session de paiement Stripe pour une intervention
     */
    @PostMapping("/create-session")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'HOST')")
    public ResponseEntity<?> createPaymentSession(
            @Valid @RequestBody PaymentSessionRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        
        try {
            // Vérifier que l'intervention existe et appartient à l'utilisateur
            Intervention intervention = interventionRepository.findById(request.getInterventionId())
                .orElseThrow(() -> new RuntimeException("Intervention non trouvée"));
            
            // Vérifier que l'intervention est en attente de paiement
            if (intervention.getStatus() != com.clenzy.model.InterventionStatus.AWAITING_PAYMENT) {
                return ResponseEntity.badRequest()
                    .body("Cette intervention n'est pas en attente de paiement. Statut actuel: " + intervention.getStatus());
            }
            
            // Vérifier que l'intervention n'est pas déjà payée
            if (intervention.getPaymentStatus() == PaymentStatus.PAID) {
                return ResponseEntity.badRequest()
                    .body("Cette intervention est déjà payée");
            }
            
            // Vérifier que le montant correspond
            if (intervention.getEstimatedCost() == null || 
                intervention.getEstimatedCost().compareTo(request.getAmount()) != 0) {
                return ResponseEntity.badRequest()
                    .body("Le montant ne correspond pas au coût estimé de l'intervention");
            }
            
            // Récupérer l'email de l'utilisateur depuis le JWT
            String customerEmail = jwt.getClaimAsString("email");
            if (customerEmail == null || customerEmail.isEmpty()) {
                return ResponseEntity.badRequest()
                    .body("Email utilisateur non trouvé");
            }
            
            // Créer la session de paiement
            Session session = stripeService.createCheckoutSession(
                request.getInterventionId(),
                request.getAmount(),
                customerEmail
            );
            
            PaymentSessionResponse response = new PaymentSessionResponse();
            response.setSessionId(session.getId());
            response.setUrl(session.getUrl());
            response.setInterventionId(intervention.getId());
            
            return ResponseEntity.ok(response);
            
        } catch (StripeException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Erreur lors de la création de la session de paiement: " + e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Erreur: " + e.getMessage());
        }
    }
    
    /**
     * Vérifie le statut d'une session de paiement
     */
    @GetMapping("/session-status/{sessionId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'HOST')")
    public ResponseEntity<?> getSessionStatus(@PathVariable String sessionId) {
        try {
            Intervention intervention = interventionRepository.findByStripeSessionId(sessionId)
                .orElseThrow(() -> new RuntimeException("Intervention non trouvée pour cette session"));
            
            return ResponseEntity.ok(intervention.getPaymentStatus());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body("Session non trouvée: " + e.getMessage());
        }
    }
}
