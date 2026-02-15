package com.clenzy.controller;

import com.clenzy.service.StripeService;
import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/webhooks/stripe")
public class StripeWebhookController {
    
    private final StripeService stripeService;
    
    @Value("${stripe.webhook-secret}")
    private String webhookSecret;
    
    @Value("${stripe.secret-key}")
    private String stripeSecretKey;
    
    public StripeWebhookController(StripeService stripeService) {
        this.stripeService = stripeService;
    }
    
    /**
     * Endpoint pour recevoir les webhooks Stripe
     * IMPORTANT: Cet endpoint ne doit PAS être protégé par Spring Security
     * car Stripe l'appelle directement
     */
    @PostMapping
    public ResponseEntity<String> handleStripeWebhook(
            @RequestBody String payload,
            @RequestHeader("Stripe-Signature") String sigHeader) {
        
        // Initialiser Stripe
        Stripe.apiKey = stripeSecretKey;
        
        Event event;
        
        try {
            // Vérifier la signature du webhook
            event = Webhook.constructEvent(payload, sigHeader, webhookSecret);
        } catch (SignatureVerificationException e) {
            // Signature invalide
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body("Signature invalide");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body("Erreur lors du traitement du webhook: " + e.getMessage());
        }
        
        // Traiter l'événement
        switch (event.getType()) {
            case "checkout.session.completed":
                Session session = (Session) event.getDataObjectDeserializer()
                    .getObject()
                    .orElse(null);
                
                if (session != null && "paid".equals(session.getPaymentStatus())) {
                    // Le paiement a été effectué avec succès
                    stripeService.confirmPayment(session.getId());
                }
                break;
                
            case "checkout.session.async_payment_succeeded":
                Session asyncSession = (Session) event.getDataObjectDeserializer()
                    .getObject()
                    .orElse(null);
                
                if (asyncSession != null) {
                    stripeService.confirmPayment(asyncSession.getId());
                }
                break;
                
            case "checkout.session.async_payment_failed":
                Session failedSession = (Session) event.getDataObjectDeserializer()
                    .getObject()
                    .orElse(null);
                
                if (failedSession != null) {
                    stripeService.markPaymentAsFailed(failedSession.getId());
                }
                break;
                
            default:
                // Autres événements non gérés
                break;
        }
        
        return ResponseEntity.ok("Webhook traité avec succès");
    }
}
