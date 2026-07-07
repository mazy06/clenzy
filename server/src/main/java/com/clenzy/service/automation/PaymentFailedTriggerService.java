package com.clenzy.service.automation;

import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.Intervention;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Reservation;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.agent.supervision.SupervisionActionType;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.service.agent.supervision.SupervisionSuggestionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
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
    private final ReservationRepository reservationRepository;
    private final AutomationEngine automationEngine;
    private final SupervisionActivityService supervisionActivityService;
    private final SupervisionSuggestionService supervisionSuggestionService;

    public PaymentFailedTriggerService(InterventionRepository interventionRepository,
                                       ReservationRepository reservationRepository,
                                       AutomationEngine automationEngine,
                                       SupervisionActivityService supervisionActivityService,
                                       SupervisionSuggestionService supervisionSuggestionService) {
        this.interventionRepository = interventionRepository;
        this.reservationRepository = reservationRepository;
        this.automationEngine = automationEngine;
        this.supervisionActivityService = supervisionActivityService;
        this.supervisionSuggestionService = supervisionSuggestionService;
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
            Long propertyId = intervention.getProperty() != null ? intervention.getProperty().getId() : null;
            // Paiement d'intervention : pas de solde voyageur régénérable → carte informationnelle.
            recordConstellationActivity(intervention.getOrganizationId(), propertyId, null, paymentIntentId);
            return;
        }

        Long orgId = parseLong(meta.get("org_id"));
        Long bookingId = parseLong(meta.get("booking_id"));
        if (orgId != null && bookingId != null) {
            fire(paymentIntentId, orgId, NotifyStaffExecutor.SUBJECT_DIRECT_BOOKING, bookingId);
            // La constellation est indexée par logement : property_id + reservation_id sont portés
            // par les metadata Stripe de la réservation directe (cf. DirectBookingService).
            recordConstellationActivity(orgId, parseLong(meta.get("property_id")),
                    parseLong(meta.get("reservation_id")), paymentIntentId);
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

    /**
     * Fait remonter l'échec de paiement dans le feed « En direct » de la CONSTELLATION du logement
     * (agent Finance « fin »). Best-effort : le record est lui-même best-effort et @Transactional côté
     * service, et un échec ne doit JAMAIS casser le capteur (donc le webhook Stripe). Aucune émission si
     * le logement n'est pas résoluble pour cette occurrence (paiement non rattaché à un bien).
     */
    private void recordConstellationActivity(Long orgId, Long propertyId, Long reservationId,
                                             String paymentIntentId) {
        if (orgId == null || propertyId == null) {
            return;
        }
        try {
            String summary = "Paiement échoué sur une réservation de ce logement"
                    + (paymentIntentId != null ? " (" + paymentIntentId + ")" : "");
            supervisionActivityService.recordModuleAct(orgId, propertyId, "fin", "payment_failed", summary);
        } catch (Exception e) {
            log.debug("payment_intent.payment_failed {} : activité constellation non enregistrée : {}",
                    paymentIntentId, e.getMessage());
        }
        // En PLUS du feed (historique), une carte HITL. Best-effort : ne casse jamais le capteur.
        try {
            recordPaymentFailedCard(orgId, propertyId, reservationId);
        } catch (Exception e) {
            log.debug("payment_intent.payment_failed {} : suggestion constellation non enregistrée : {}",
                    paymentIntentId, e.getMessage());
        }
    }

    /**
     * Carte « Paiement échoué à relancer ». APPLICABLE (« Relancer le paiement » via PAYMENT_REMINDER)
     * uniquement si le solde différé est régénérable — réservation {@code PARTIALLY_PAID} avec un solde
     * dû &gt; 0 (seul cas où {@code BookingBalanceService.createBalanceCheckoutUrl} réussit). Sinon carte
     * informationnelle. L'état est re-résolu à l'apply — la carte ne fait que porter le reservationId.
     */
    private void recordPaymentFailedCard(Long orgId, Long propertyId, Long reservationId) {
        final String title = "Paiement échoué à relancer";
        if (reservationId != null) {
            Reservation reservation = reservationRepository.findById(reservationId).orElse(null);
            if (reservation != null
                    && orgId.equals(reservation.getOrganizationId())
                    && reservation.getPaymentStatus() == PaymentStatus.PARTIALLY_PAID
                    && reservation.getAmountDue() != null
                    && reservation.getAmountDue().compareTo(BigDecimal.ZERO) > 0) {
                String params = String.format("{\"reservationId\":%d}", reservationId);
                String motif = "Le paiement du solde (" + reservation.getAmountDue()
                        + ") a échoué — régénérer un lien de paiement et relancer le voyageur.";
                supervisionSuggestionService.recordActionable(orgId, propertyId, "fin", title, motif,
                        SupervisionActionType.PAYMENT_REMINDER, params, null, "warning");
                return;
            }
        }
        supervisionSuggestionService.record(orgId, propertyId, "fin", "payment_failed", title,
                "Le paiement d’une réservation de ce logement a échoué — relancer le voyageur.");
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
