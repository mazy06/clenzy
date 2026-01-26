package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.PaymentStatus;
import com.clenzy.repository.InterventionRepository;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Service
@Transactional
public class StripeService {
    
    private final InterventionRepository interventionRepository;
    
    @Value("${stripe.secret-key}")
    private String stripeSecretKey;
    
    @Value("${stripe.currency}")
    private String currency;
    
    @Value("${stripe.success-url}")
    private String successUrl;
    
    @Value("${stripe.cancel-url}")
    private String cancelUrl;
    
    public StripeService(InterventionRepository interventionRepository) {
        this.interventionRepository = interventionRepository;
        // Stripe sera initialisé avec la clé secrète depuis les propriétés
    }
    
    /**
     * Crée une session de paiement Stripe pour une intervention
     */
    public Session createCheckoutSession(Long interventionId, BigDecimal amount, String customerEmail) throws StripeException {
        // Initialiser Stripe avec la clé secrète
        Stripe.apiKey = stripeSecretKey;
        
        // Récupérer l'intervention
        Intervention intervention = interventionRepository.findById(interventionId)
            .orElseThrow(() -> new RuntimeException("Intervention non trouvée: " + interventionId));
        
        // Convertir le montant en centimes (Stripe utilise les centimes)
        long amountInCents = amount.multiply(BigDecimal.valueOf(100)).longValue();
        
        // Créer les paramètres de la session
        SessionCreateParams params = SessionCreateParams.builder()
            .setMode(SessionCreateParams.Mode.PAYMENT)
            .setSuccessUrl(successUrl)
            .setCancelUrl(cancelUrl)
            .addLineItem(
                SessionCreateParams.LineItem.builder()
                    .setQuantity(1L)
                    .setPriceData(
                        SessionCreateParams.LineItem.PriceData.builder()
                            .setCurrency(currency.toLowerCase())
                            .setUnitAmount(amountInCents)
                            .setProductData(
                                SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                    .setName("Intervention: " + intervention.getTitle())
                                    .setDescription(intervention.getDescription() != null ? 
                                        intervention.getDescription() : "Paiement pour l'intervention")
                                    .build()
                            )
                            .build()
                    )
                    .build()
            )
            .setCustomerEmail(customerEmail)
            .putMetadata("intervention_id", interventionId.toString())
            .build();
        
        // Créer la session
        Session session = Session.create(params);
        
        // Sauvegarder l'ID de la session dans l'intervention
        intervention.setStripeSessionId(session.getId());
        intervention.setPaymentStatus(PaymentStatus.PROCESSING);
        interventionRepository.save(intervention);
        
        return session;
    }
    
    /**
     * Confirme le paiement d'une intervention après réception du webhook
     */
    public void confirmPayment(String sessionId) {
        Intervention intervention = interventionRepository.findByStripeSessionId(sessionId)
            .orElseThrow(() -> new RuntimeException("Intervention non trouvée pour la session: " + sessionId));
        
        intervention.setPaymentStatus(PaymentStatus.PAID);
        intervention.setPaidAt(LocalDateTime.now());
        // Changer le statut de l'intervention de AWAITING_PAYMENT à PENDING (prête à être planifiée)
        if (intervention.getStatus() == InterventionStatus.AWAITING_PAYMENT) {
            intervention.setStatus(InterventionStatus.PENDING);
        }
        interventionRepository.save(intervention);
    }
    
    /**
     * Marque un paiement comme échoué
     */
    public void markPaymentAsFailed(String sessionId) {
        Intervention intervention = interventionRepository.findByStripeSessionId(sessionId)
            .orElse(null);
        
        if (intervention != null) {
            intervention.setPaymentStatus(PaymentStatus.FAILED);
            interventionRepository.save(intervention);
        }
    }
}
