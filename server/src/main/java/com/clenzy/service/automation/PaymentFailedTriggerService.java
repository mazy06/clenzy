package com.clenzy.service.automation;

import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.Intervention;
import com.clenzy.repository.InterventionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * Capteur du declencheur {@link AutomationTrigger#PAYMENT_FAILED} (flux F5c).
 *
 * <p>Appele par {@code StripeWebhookController} sur
 * {@code payment_intent.payment_failed} : resout l'organisation et le sujet
 * depuis les metadata du PaymentIntent, puis delegue au moteur AutomationRule
 * (action typique : NOTIFY_STAFF). Le capteur ne notifie RIEN lui-meme.</p>
 *
 * <p>Resolution du sujet :</p>
 * <ul>
 *   <li>{@code interventionId} (paiements d'intervention, mobile inclus) →
 *       org chargee depuis l'intervention, sujet INTERVENTION ;</li>
 *   <li>{@code org_id} + {@code booking_id} (booking engine direct) →
 *       sujet DIRECT_BOOKING ;</li>
 *   <li>sinon (inscription, upgrade forfait sans org...) : pas d'org
 *       resoluble → aucun declenchement (logge).</li>
 * </ul>
 */
@Service
public class PaymentFailedTriggerService {

    private static final Logger log = LoggerFactory.getLogger(PaymentFailedTriggerService.class);

    private final InterventionRepository interventionRepository;
    private final AutomationEngine automationEngine;

    public PaymentFailedTriggerService(InterventionRepository interventionRepository,
                                       AutomationEngine automationEngine) {
        this.interventionRepository = interventionRepository;
        this.automationEngine = automationEngine;
    }

    /**
     * Declenche PAYMENT_FAILED si une organisation est resoluble depuis les
     * metadata. Une exception (DB) remonte au webhook (500 → re-livraison
     * Stripe) — le moteur est idempotent sur re-livraison.
     */
    public void fireForFailedPaymentIntent(String paymentIntentId, Map<String, String> metadata) {
        Map<String, String> meta = metadata != null ? metadata : Map.of();

        Long interventionId = parseLong(meta.get("interventionId"));
        if (interventionId != null) {
            Intervention intervention = interventionRepository.findById(interventionId).orElse(null);
            if (intervention == null) {
                log.warn("payment_intent.payment_failed {} : intervention {} introuvable, pas de declenchement",
                        paymentIntentId, interventionId);
                return;
            }
            fire(paymentIntentId, intervention.getOrganizationId(),
                    NotifyStaffExecutor.SUBJECT_INTERVENTION, interventionId);
            return;
        }

        Long orgId = parseLong(meta.get("org_id"));
        Long bookingId = parseLong(meta.get("booking_id"));
        if (orgId != null && bookingId != null) {
            fire(paymentIntentId, orgId, NotifyStaffExecutor.SUBJECT_DIRECT_BOOKING, bookingId);
            return;
        }

        log.info("payment_intent.payment_failed {} : organisation non resoluble (type={}), pas de declenchement",
                paymentIntentId, meta.get("type"));
    }

    private void fire(String paymentIntentId, Long orgId, String subjectType, Long subjectId) {
        Map<String, Object> data = new HashMap<>();
        if (paymentIntentId != null) {
            data.put(NotifyStaffExecutor.DATA_PAYMENT_INTENT_ID, paymentIntentId);
        }
        automationEngine.fireTrigger(AutomationTrigger.PAYMENT_FAILED, orgId,
                new AutomationSubject(subjectType, subjectId, data));
    }

    private static Long parseLong(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(raw.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
