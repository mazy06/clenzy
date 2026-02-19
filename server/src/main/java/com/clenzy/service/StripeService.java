package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.PaymentStatus;
import com.clenzy.config.KafkaConfig;
import com.clenzy.repository.InterventionRepository;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.Refund;
import com.stripe.model.checkout.Session;
import com.stripe.param.RefundCreateParams;
import com.stripe.param.checkout.SessionCreateParams;
import com.clenzy.tenant.TenantContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

@Service
@Transactional
public class StripeService {
    
    private final InterventionRepository interventionRepository;
    private final NotificationService notificationService;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final TenantContext tenantContext;

    @Value("${stripe.secret-key}")
    private String stripeSecretKey;

    @Value("${stripe.currency}")
    private String currency;

    @Value("${stripe.success-url}")
    private String successUrl;

    @Value("${stripe.cancel-url}")
    private String cancelUrl;

    public StripeService(InterventionRepository interventionRepository, NotificationService notificationService, KafkaTemplate<String, Object> kafkaTemplate, TenantContext tenantContext) {
        this.interventionRepository = interventionRepository;
        this.notificationService = notificationService;
        this.kafkaTemplate = kafkaTemplate;
        this.tenantContext = tenantContext;
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
        Intervention intervention = interventionRepository.findByStripeSessionId(sessionId, tenantContext.getRequiredOrganizationId())
            .orElseThrow(() -> new RuntimeException("Intervention non trouvée pour la session: " + sessionId));

        intervention.setPaymentStatus(PaymentStatus.PAID);
        intervention.setPaidAt(LocalDateTime.now());
        // Changer le statut de l'intervention de AWAITING_PAYMENT à PENDING (prête à être planifiée)
        if (intervention.getStatus() == InterventionStatus.AWAITING_PAYMENT) {
            intervention.setStatus(InterventionStatus.PENDING);
        }
        interventionRepository.save(intervention);

        try {
            if (intervention.getProperty() != null && intervention.getProperty().getOwner() != null
                    && intervention.getProperty().getOwner().getKeycloakId() != null) {
                notificationService.notify(
                    intervention.getProperty().getOwner().getKeycloakId(),
                    NotificationKey.PAYMENT_CONFIRMED,
                    "Paiement confirme",
                    "Le paiement pour l'intervention \"" + intervention.getTitle() + "\" a ete confirme",
                    "/interventions/" + intervention.getId()
                );
            }
            // Notifier également les admins/managers
            notificationService.notifyAdminsAndManagers(
                NotificationKey.PAYMENT_CONFIRMED,
                "Paiement confirme",
                "Le paiement pour l'intervention \"" + intervention.getTitle() + "\" a ete confirme",
                "/interventions/" + intervention.getId()
            );

            // Notifier les admins/managers qu'une action d'assignation est requise
            notificationService.notifyAdminsAndManagers(
                NotificationKey.INTERVENTION_AWAITING_VALIDATION,
                "Action requise : assignation",
                "L'intervention \"" + intervention.getTitle() + "\" est payee et en attente d'assignation d'equipe.",
                "/interventions"
            );
        } catch (Exception e) {
            System.err.println("Erreur notification PAYMENT_CONFIRMED: " + e.getMessage());
        }

        // ─── Génération automatique FACTURE + JUSTIFICATIF_PAIEMENT ──────────
        try {
            String emailTo = (intervention.getProperty() != null && intervention.getProperty().getOwner() != null)
                    ? intervention.getProperty().getOwner().getEmail() : "";

            kafkaTemplate.send(
                KafkaConfig.TOPIC_DOCUMENT_GENERATE,
                "facture-int-" + intervention.getId(),
                Map.of(
                    "documentType", "FACTURE",
                    "referenceId", intervention.getId(),
                    "referenceType", "intervention",
                    "emailTo", emailTo != null ? emailTo : ""
                )
            );

            kafkaTemplate.send(
                KafkaConfig.TOPIC_DOCUMENT_GENERATE,
                "justif-paiement-int-" + intervention.getId(),
                Map.of(
                    "documentType", "JUSTIFICATIF_PAIEMENT",
                    "referenceId", intervention.getId(),
                    "referenceType", "intervention",
                    "emailTo", emailTo != null ? emailTo : ""
                )
            );
            System.out.println("📄 Événements FACTURE + JUSTIFICATIF_PAIEMENT publiés sur Kafka pour l'intervention: " + intervention.getId());
        } catch (Exception e) {
            System.err.println("Erreur publication Kafka FACTURE/JUSTIFICATIF_PAIEMENT: " + e.getMessage());
        }
    }
    
    /**
     * Marque un paiement comme échoué
     */
    public void markPaymentAsFailed(String sessionId) {
        Intervention intervention = interventionRepository.findByStripeSessionId(sessionId, tenantContext.getRequiredOrganizationId())
            .orElse(null);

        if (intervention != null) {
            intervention.setPaymentStatus(PaymentStatus.FAILED);
            interventionRepository.save(intervention);

            try {
                // Notify property owner
                if (intervention.getProperty() != null && intervention.getProperty().getOwner() != null
                        && intervention.getProperty().getOwner().getKeycloakId() != null) {
                    notificationService.notify(
                        intervention.getProperty().getOwner().getKeycloakId(),
                        NotificationKey.PAYMENT_FAILED,
                        "Echec du paiement",
                        "Le paiement pour l'intervention \"" + intervention.getTitle() + "\" a echoue",
                        "/interventions/" + intervention.getId()
                    );
                }
                // Also notify admins/managers
                notificationService.notifyAdminsAndManagers(
                    NotificationKey.PAYMENT_FAILED,
                    "Echec du paiement",
                    "Le paiement pour l'intervention \"" + intervention.getTitle() + "\" a echoue",
                    "/interventions/" + intervention.getId()
                );
            } catch (Exception e) {
                System.err.println("Erreur notification PAYMENT_FAILED: " + e.getMessage());
            }
        }
    }

    /**
     * Confirme le paiement groupe de plusieurs interventions (paiement differe).
     * Chaque intervention incluse passe en PAID.
     */
    public void confirmGroupedPayment(String sessionId, String interventionIds) {
        if (interventionIds == null || interventionIds.isBlank()) return;

        String[] ids = interventionIds.split(",");
        for (String idStr : ids) {
            try {
                Long id = Long.parseLong(idStr.trim());
                Intervention intervention = interventionRepository.findById(id).orElse(null);
                if (intervention != null) {
                    intervention.setPaymentStatus(PaymentStatus.PAID);
                    intervention.setPaidAt(LocalDateTime.now());
                    intervention.setStripeSessionId(sessionId);
                    interventionRepository.save(intervention);

                    // ─── Génération automatique FACTURE + JUSTIFICATIF_PAIEMENT ──
                    try {
                        String emailTo = (intervention.getProperty() != null && intervention.getProperty().getOwner() != null)
                                ? intervention.getProperty().getOwner().getEmail() : "";

                        kafkaTemplate.send(
                            KafkaConfig.TOPIC_DOCUMENT_GENERATE,
                            "facture-int-" + intervention.getId(),
                            Map.of(
                                "documentType", "FACTURE",
                                "referenceId", intervention.getId(),
                                "referenceType", "intervention",
                                "emailTo", emailTo != null ? emailTo : ""
                            )
                        );
                        kafkaTemplate.send(
                            KafkaConfig.TOPIC_DOCUMENT_GENERATE,
                            "justif-paiement-int-" + intervention.getId(),
                            Map.of(
                                "documentType", "JUSTIFICATIF_PAIEMENT",
                                "referenceId", intervention.getId(),
                                "referenceType", "intervention",
                                "emailTo", emailTo != null ? emailTo : ""
                            )
                        );
                        System.out.println("📄 Événements FACTURE + JUSTIFICATIF_PAIEMENT publiés (groupé) pour l'intervention: " + intervention.getId());
                    } catch (Exception e) {
                        System.err.println("Erreur publication Kafka FACTURE/JUSTIFICATIF (groupé): " + e.getMessage());
                    }
                }
            } catch (NumberFormatException e) {
                // Ignorer les IDs invalides
            }
        }
    }

    /**
     * Marque le paiement groupe comme echoue pour toutes les interventions incluses.
     */
    public void markGroupedPaymentAsFailed(String interventionIds) {
        if (interventionIds == null || interventionIds.isBlank()) return;

        String[] ids = interventionIds.split(",");
        for (String idStr : ids) {
            try {
                Long id = Long.parseLong(idStr.trim());
                Intervention intervention = interventionRepository.findById(id).orElse(null);
                if (intervention != null) {
                    intervention.setPaymentStatus(PaymentStatus.FAILED);
                    interventionRepository.save(intervention);
                }
            } catch (NumberFormatException e) {
                // Ignorer les IDs invalides
            }
        }
    }

    /**
     * Rembourse un paiement via Stripe et met a jour le statut de l'intervention.
     */
    public void refundPayment(Long interventionId) throws StripeException {
        Stripe.apiKey = stripeSecretKey;

        Intervention intervention = interventionRepository.findById(interventionId)
            .orElseThrow(() -> new RuntimeException("Intervention non trouvee: " + interventionId));

        if (intervention.getPaymentStatus() != PaymentStatus.PAID) {
            throw new RuntimeException("Seuls les paiements confirmes peuvent etre rembourses. Statut actuel: " + intervention.getPaymentStatus());
        }

        // Recuperer le PaymentIntent depuis la session Stripe
        String sessionId = intervention.getStripeSessionId();
        if (sessionId == null || sessionId.isBlank()) {
            throw new RuntimeException("Aucune session Stripe associee a cette intervention");
        }

        Session session = Session.retrieve(sessionId);
        String paymentIntentId = session.getPaymentIntent();
        if (paymentIntentId == null || paymentIntentId.isBlank()) {
            throw new RuntimeException("Aucun PaymentIntent trouve pour la session: " + sessionId);
        }

        // Creer le remboursement Stripe (remboursement total)
        RefundCreateParams refundParams = RefundCreateParams.builder()
            .setPaymentIntent(paymentIntentId)
            .build();
        Refund.create(refundParams);

        // Mettre a jour le statut
        intervention.setPaymentStatus(PaymentStatus.REFUNDED);
        interventionRepository.save(intervention);

        // Notifications
        try {
            if (intervention.getProperty() != null && intervention.getProperty().getOwner() != null
                    && intervention.getProperty().getOwner().getKeycloakId() != null) {
                notificationService.notify(
                    intervention.getProperty().getOwner().getKeycloakId(),
                    NotificationKey.PAYMENT_REFUND_COMPLETED,
                    "Remboursement effectue",
                    "Le paiement pour l'intervention \"" + intervention.getTitle() + "\" a ete rembourse",
                    "/interventions/" + intervention.getId()
                );
            }
            notificationService.notifyAdminsAndManagers(
                NotificationKey.PAYMENT_REFUND_COMPLETED,
                "Remboursement effectue",
                "Le paiement pour l'intervention \"" + intervention.getTitle() + "\" a ete rembourse",
                "/interventions/" + intervention.getId()
            );
        } catch (Exception e) {
            System.err.println("Erreur notification PAYMENT_REFUND_COMPLETED: " + e.getMessage());
        }

        // ─── Génération automatique JUSTIFICATIF_REMBOURSEMENT ───────────────
        try {
            String emailTo = (intervention.getProperty() != null && intervention.getProperty().getOwner() != null)
                    ? intervention.getProperty().getOwner().getEmail() : "";

            kafkaTemplate.send(
                KafkaConfig.TOPIC_DOCUMENT_GENERATE,
                "justif-remboursement-int-" + intervention.getId(),
                Map.of(
                    "documentType", "JUSTIFICATIF_REMBOURSEMENT",
                    "referenceId", intervention.getId(),
                    "referenceType", "intervention",
                    "emailTo", emailTo != null ? emailTo : ""
                )
            );
            System.out.println("📄 Événement JUSTIFICATIF_REMBOURSEMENT publié sur Kafka pour l'intervention: " + intervention.getId());
        } catch (Exception e) {
            System.err.println("Erreur publication Kafka JUSTIFICATIF_REMBOURSEMENT: " + e.getMessage());
        }
    }
}
