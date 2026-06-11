package com.clenzy.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.ServiceRequest;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.ServiceRequestRepository;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Verification du paiement Stripe d'une demande de service.
 *
 * <p>Logique deplacee de ServiceRequestController (T-ARCH-01) : l'appel Stripe
 * passe par {@link StripeGateway} (RequestOptions par appel) au lieu de muter
 * l'etat statique global Stripe.apiKey. PAS de @Transactional : appel HTTP
 * externe (Stripe).</p>
 *
 * <p>Classe dediee (et non ServiceRequestService) car StripeService depend de
 * ServiceRequestService — y injecter StripeService creerait un cycle.</p>
 */
@Service
public class ServiceRequestPaymentService {

    private static final Logger log = LoggerFactory.getLogger(ServiceRequestPaymentService.class);

    private final ServiceRequestRepository serviceRequestRepository;
    private final StripeService stripeService;
    private final StripeGateway stripeGateway;

    public ServiceRequestPaymentService(ServiceRequestRepository serviceRequestRepository,
                                        StripeService stripeService,
                                        StripeGateway stripeGateway) {
        this.serviceRequestRepository = serviceRequestRepository;
        this.stripeService = stripeService;
        this.stripeGateway = stripeGateway;
    }

    /**
     * Verifie directement aupres de Stripe si le paiement a ete effectue.
     * Confirme automatiquement (+ cree l'intervention) si Stripe indique paid.
     *
     * @return corps de reponse (paymentStatus / message)
     * @throws NotFoundException si la demande de service n'existe pas
     */
    public Map<String, String> checkPaymentStatus(Long id) throws StripeException {
        ServiceRequest sr = serviceRequestRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Demande de service non trouvee: " + id));

        // Already paid?
        if (sr.getPaymentStatus() == PaymentStatus.PAID) {
            return Map.of(
                    "paymentStatus", "PAID",
                    "message", "Paiement deja confirme"
            );
        }

        String sessionId = sr.getStripeSessionId();
        if (sessionId == null || sessionId.isBlank()) {
            return Map.of(
                    "paymentStatus", "NO_SESSION",
                    "message", "Aucune session de paiement Stripe associee"
            );
        }

        Session stripeSession = stripeGateway.retrieveSession(sessionId);
        String stripePaymentStatus = stripeSession.getPaymentStatus();

        log.info("Check payment SR {}: Stripe session {} paymentStatus={}",
                id, sessionId, stripePaymentStatus);

        if ("paid".equals(stripePaymentStatus)) {
            // Webhook missed — confirm manually (creates intervention too)
            stripeService.confirmServiceRequestPayment(sessionId);
            return Map.of(
                    "paymentStatus", "PAID",
                    "message", "Paiement confirme (webhook rattrape)"
            );
        }

        return Map.of(
                "paymentStatus", stripePaymentStatus != null ? stripePaymentStatus.toUpperCase() : "UNKNOWN",
                "message", "Paiement non encore confirme sur Stripe"
        );
    }
}
