package com.clenzy.service;

import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.PaymentStatus;
import com.clenzy.exception.PaymentValidationException;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.repository.ServiceQuoteRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.TreeSet;
import java.math.BigDecimal;
import java.time.LocalDate;

/** Verrous conservés jusqu'au commit de l'intention de paiement ou de l'avenant. */
@Service
@Transactional(propagation = Propagation.MANDATORY)
public class InterventionPaymentCoordination {
    private final EntityManager em;
    private final PaymentTransactionRepository payments;
    private final ServiceQuoteRepository quotes;
    private final CurrencyConverterService currencyConverter;

    public InterventionPaymentCoordination(EntityManager em, PaymentTransactionRepository payments,
                                          ServiceQuoteRepository quotes, CurrencyConverterService currencyConverter) {
        this.em = em;
        this.payments = payments;
        this.quotes = quotes;
        this.currencyConverter = currencyConverter;
    }

    public java.util.Map<Long, BigDecimal> lockPaymentMissions(Long orgId, PaymentOrchestrationRequest request) {
        if (ServiceRequestPaymentService.SOURCE_TYPE.equals(request.sourceType())) {
            lockServiceRequestCheckout(orgId, request);
            return java.util.Map.of();
        }
        var ids = missionIds(request);
        if (ids.isEmpty()) return java.util.Map.of();
        // Même ordre que la confirmation et l'accord prestataire : besoins, puis missions.
        var linkedRequests = new java.util.TreeMap<Long, com.clenzy.model.ServiceRequest>();
        for (Long id : ids) {
            var mission = em.find(Intervention.class, id);
            if (mission == null || !Objects.equals(orgId, mission.getOrganizationId()))
                throw new AccessDeniedException("Mission inaccessible dans cette organisation");
            if (mission.getServiceRequest() != null)
                linkedRequests.put(mission.getServiceRequest().getId(), mission.getServiceRequest());
        }
        for (var need : linkedRequests.values()) {
            em.refresh(need, LockModeType.PESSIMISTIC_WRITE);
            if (!Objects.equals(orgId, need.getOrganizationId())) throw new AccessDeniedException("Demande hors organisation");
            ServiceRequestPaymentPersistence.requireUnsettled(need);
            if (need.getPaymentStatus() == PaymentStatus.PROCESSING
                    || (need.getStripeSessionId() != null && !need.getStripeSessionId().isBlank())
                    || hasRequestPayment(orgId, need.getId()))
                throw new PaymentValidationException("Un paiement existe déjà pour la demande liée ; rapprochement requis.");
        }
        var missions = ids.stream().map(id -> lockMission(orgId, id)).toList();
        boolean direct = "INTERVENTION".equals(request.sourceType())
                || InterventionPaymentBatch.SOURCE_TYPE.equals(request.sourceType());
        boolean deposit = request.metadata() != null && "DEPOSIT".equalsIgnoreCase(request.metadata().get("purpose"));
        if (deposit && (!direct || ids.size() != 1)) throw new PaymentValidationException("Acompte groupé non pris en charge");
        BigDecimal total = BigDecimal.ZERO;
        var amounts = new java.util.LinkedHashMap<Long, BigDecimal>();
        LocalDate date = LocalDate.now();
        for (var mission : missions) {
            if (mission.getServiceRequest() != null && !linkedRequests.containsKey(mission.getServiceRequest().getId()))
                throw new PaymentValidationException("La demande liée a changé ; actualisez la mission.");
            if (payments.hasOpenInterventionPayment(orgId, mission.getId())) {
                throw new PaymentValidationException("Un paiement est déjà en cours pour cette mission. Reprenez sa session existante.");
            }
            if (mission.getStatus() == InterventionStatus.CANCELLED
                    || mission.getPaymentStatus() == PaymentStatus.PAID) {
                throw new PaymentValidationException("Cette mission ne peut plus être payée");
            }
            var agreement = quotes.findByInterventionIdAndOrganizationIdOrderByAmountAsc(mission.getId(), orgId);
            // Écarter un devis conservé dans le contexte de persistance avant l'acquisition du verrou.
            agreement.forEach(em::refresh);
            BigDecimal amount = InterventionPaymentAmounts.payable(mission, agreement, deposit);
            if (amount == null || amount.signum() <= 0) throw new PaymentValidationException("Cette mission ne présente aucun montant exigible");
            String currency = mission.getCurrency();
            if (currency == null || currency.isBlank()) currency = direct ? "EUR" : request.currency();
            if (request.currency() == null || request.currency().isBlank()) throw new PaymentValidationException("Devise requise");
            if (direct) {
                if (!currency.equalsIgnoreCase(request.currency())) throw new PaymentValidationException("La devise de la mission a changé");
            } else {
                amount = currencyConverter.convert(amount, currency, request.currency(), date);
            }
            total = total.add(amount);
            amounts.put(mission.getId(), amount);
        }
        if (request.amount() == null || total.compareTo(request.amount()) != 0) {
            throw new PaymentValidationException("Le montant à payer a changé ; actualisez les missions");
        }
        return amounts;
    }

    private boolean hasRequestPayment(Long orgId, Long requestId) {
        // FAILED peut être une réponse réseau perdue après la création de la session PSP.
        return payments.findByOrganizationIdAndSourceTypeAndSourceId(orgId, ServiceRequestPaymentService.SOURCE_TYPE, requestId)
                .stream().anyMatch(t -> t.getPaymentType() == com.clenzy.model.TransactionType.CHECKOUT
                        && t.getStatus() != com.clenzy.model.TransactionStatus.CANCELLED);
    }

    private void lockServiceRequestCheckout(Long orgId, PaymentOrchestrationRequest checkout) {
        var need = em.find(com.clenzy.model.ServiceRequest.class, checkout.sourceId());
        if (need == null || !Objects.equals(orgId, need.getOrganizationId()))
            throw new AccessDeniedException("Demande hors organisation");
        em.refresh(need, LockModeType.PESSIMISTIC_WRITE);
        if (!Objects.equals(orgId, need.getOrganizationId())) throw new AccessDeniedException("Demande hors organisation");
        ServiceRequestPaymentPersistence.requireUnsettled(need);
        if (need.getConvertedInterventionId() != null || em.createQuery(
                "select count(i) from Intervention i where i.serviceRequest.id=:id", Long.class)
                .setParameter("id", need.getId()).getSingleResult() > 0)
            throw new PaymentValidationException("Cette demande est déjà convertie : utilisez l'intervention liée.");
        if (need.getStatus() != com.clenzy.model.RequestStatus.AWAITING_PAYMENT
                || need.getEstimatedCost() == null || checkout.amount() == null
                || need.getEstimatedCost().signum() <= 0 || need.getEstimatedCost().compareTo(checkout.amount()) != 0)
            throw new PaymentValidationException("La demande ou son montant a changé ; actualisez le paiement.");
        if ((need.getStripeSessionId() != null && !need.getStripeSessionId().isBlank())
                || need.getPaymentStatus() == PaymentStatus.PROCESSING || hasRequestPayment(orgId, need.getId()))
            throw new PaymentValidationException("Un paiement existe déjà pour cette demande ; reprenez sa session ou rapprochez son état.");
    }

    public void recordBatchAllocations(com.clenzy.model.PaymentTransaction tx, java.util.Map<Long, BigDecimal> amounts) {
        if (!InterventionPaymentBatch.SOURCE_TYPE.equals(tx.getSourceType())) return;
        if (amounts == null || amounts.isEmpty()) throw new IllegalStateException("Répartition du lot absente");
        var parts = amounts.entrySet().stream().map(e -> new com.clenzy.model.InterventionPaymentAllocation(tx, e.getKey(), e.getValue())).toList();
        InterventionPaymentBatch.validate(tx, parts);
        parts.forEach(em::persist);
    }

    /** Association atomique avec la transaction PSP, avant toute confirmation du webhook. */
    public void attachBatchSession(com.clenzy.model.PaymentTransaction tx) {
        if (!InterventionPaymentBatch.SOURCE_TYPE.equals(tx.getSourceType())) return;
        if (tx.getProviderTxId() == null || tx.getProviderTxId().isBlank()) throw new IllegalStateException("Session du lot absente");
        var allocations = em.createQuery("select a from InterventionPaymentAllocation a where a.transaction.id=:id order by a.interventionId",
                com.clenzy.model.InterventionPaymentAllocation.class).setParameter("id", tx.getId()).getResultList();
        if (allocations.isEmpty()) throw new IllegalStateException("Répartition du lot absente");
        for (var allocation : allocations) {
            var mission = lockMission(tx.getOrganizationId(), allocation.getInterventionId());
            if (mission.getPaymentStatus() == PaymentStatus.PAID || mission.getPaymentStatus() == PaymentStatus.REFUNDED)
                throw new IllegalStateException("L'état financier de la mission a changé ; rapprochement requis");
            mission.setStripeSessionId(tx.getProviderTxId());
            mission.setPaymentStatus(PaymentStatus.PROCESSING);
        }
    }

    public Intervention lockMission(Long orgId, Long id) {
        var mission = em.find(Intervention.class, id);
        if (mission == null) throw new NotFoundException("Mission introuvable");
        if (orgId == null || !Objects.equals(orgId, mission.getOrganizationId())) {
            throw new AccessDeniedException("Mission inaccessible dans cette organisation");
        }
        // refresh est requis même si find renvoie une entité déjà chargée avant le verrou.
        em.refresh(mission, LockModeType.PESSIMISTIC_WRITE);
        if (!Objects.equals(orgId, mission.getOrganizationId())) {
            throw new AccessDeniedException("Mission inaccessible dans cette organisation");
        }
        return mission;
    }

    /** L'appelant conserve le verrou de mission pendant la décision commerciale. */
    public void requireNoRecordedPayment(Intervention mission) {
        if (hasRecordedPayment(mission)) {
            throw new IllegalStateException("Un paiement est déjà engagé pour cette mission");
        }
    }

    public boolean hasRecordedPayment(Intervention mission) {
        return payments.hasRecordedInterventionPayment(mission.getOrganizationId(), mission.getId());
    }

    /** Valide avant l'émission les préconditions des contre-écritures d'une mission entière. */
    public void requireStandaloneRefund(com.clenzy.model.PaymentTransaction payment) {
        requireStandaloneRefund(payment, false);
    }

    public void requireStandaloneRefundSeries(com.clenzy.model.PaymentTransaction payment) {
        requireStandaloneRefund(payment, true);
    }

    private void requireStandaloneRefund(com.clenzy.model.PaymentTransaction payment, boolean series) {
        var mission = lockMission(payment.getOrganizationId(), payment.getSourceId());
        String currency = mission.getCurrency() == null ? "EUR" : mission.getCurrency();
        if ((mission.getPaymentStatus() != PaymentStatus.PAID && !(series && mission.getPaymentStatus()==PaymentStatus.PARTIALLY_REFUNDED)) || mission.getEstimatedCost() == null
                || mission.getEstimatedCost().compareTo(payment.getAmount()) != 0
                || !currency.equalsIgnoreCase(payment.getCurrency())
                || (payment.getProviderType() == com.clenzy.model.PaymentProviderType.STRIPE
                    && !Objects.equals(mission.getStripeSessionId(), payment.getProviderTxId()))) {
            throw new PaymentValidationException("Le remboursement exige un encaissement rapproché de cette mission.");
        }
        Number shared = (Number) em.createNativeQuery("""
            SELECT (SELECT count(*) FROM interventions WHERE organization_id=:org
                    AND stripe_session_id=:session AND id<>:mission)
                 + (SELECT count(*) FROM intervention_payment_allocations WHERE organization_id=:org AND transaction_id=:payment)
            """).setParameter("org", payment.getOrganizationId()).setParameter("session", payment.getProviderTxId())
                .setParameter("mission", payment.getSourceId()).setParameter("payment", payment.getId()).getSingleResult();
        if (shared.longValue() > 0) throw new PaymentValidationException("Ce paiement partagé exige un remboursement par allocation.");
        requireRefundOutsideCancellationCase(payment);
    }

    public void requireRefundOutsideCancellationCase(com.clenzy.model.PaymentTransaction payment) {
        Number count=(Number)em.createNativeQuery("""
            SELECT count(*) FROM service_quote_cancellations c LEFT JOIN interventions i ON i.id=c.intervention_id
            LEFT JOIN service_requests r ON r.id=i.service_request_id
            WHERE c.organization_id=:org AND (i.stripe_session_id=:session OR r.stripe_session_id=:session OR EXISTS (
              SELECT 1 FROM payment_transactions t WHERE t.id=:payment AND t.organization_id=c.organization_id AND (
                (t.source_type IN ('INTERVENTION','INTERVENTION_BATCH') AND (t.source_id=c.intervention_id OR cast(c.intervention_id AS text)=ANY(string_to_array(replace(t.metadata->>'interventionIds',' ',''),','))))
                OR (t.source_type IN ('DEFERRED_INTERVENTIONS_HOST','DEFERRED_INTERVENTIONS_PROPERTY') AND cast(c.intervention_id AS text)=ANY(string_to_array(replace(t.metadata->>'intervention_ids',' ',''),',')))
                OR (t.source_type='SERVICE_REQUEST' AND t.source_id=i.service_request_id))) OR EXISTS (
              SELECT 1 FROM mission_financial_payments p WHERE p.quote_id=c.quote_id AND p.session_ref=:session))
            """).setParameter("org",payment.getOrganizationId()).setParameter("session",payment.getProviderTxId())
                .setParameter("payment",payment.getId()).getSingleResult();
        if(count.longValue()>0) throw new IllegalStateException("Utilisez le dossier financier de l'accord annulé");
    }

    /** Décision d'annulation : inclut les anciens marqueurs et les transactions durables. */
    public boolean cancellationNeedsPaymentReview(Intervention mission) {
        return mission.getPaidAt() != null
                || (mission.getStripeSessionId() != null && !mission.getStripeSessionId().isBlank())
                || mission.getPaymentStatus() == PaymentStatus.PAID
                || mission.getPaymentStatus() == PaymentStatus.PARTIALLY_PAID
                || mission.getPaymentStatus() == PaymentStatus.PROCESSING
                || mission.getPaymentStatus() == PaymentStatus.REFUNDED
                || hasRecordedPayment(mission);
    }

    static List<Long> missionIds(PaymentOrchestrationRequest request) {
        boolean direct = "INTERVENTION".equals(request.sourceType())
                || InterventionPaymentBatch.SOURCE_TYPE.equals(request.sourceType());
        boolean deferred = DeferredPaymentService.SOURCE_TYPE_HOST.equals(request.sourceType())
                || DeferredPaymentService.SOURCE_TYPE_PROPERTY.equals(request.sourceType());
        if (!direct && !deferred) return List.of();
        var ids = new TreeSet<Long>();
        if (direct) {
            if (request.sourceId() == null || request.sourceId() <= 0) throw invalidBatch();
            ids.add(request.sourceId());
        }
        String batch = request.metadata() == null ? null
                : request.metadata().get(direct ? "interventionIds" : "intervention_ids");
        if (batch != null) {
            for (String value : batch.split(",", -1)) {
                try {
                    long id = Long.parseLong(value.strip());
                    if (id <= 0 || !Long.toString(id).equals(value.strip())) throw invalidBatch();
                    ids.add(id);
                } catch (NumberFormatException ex) {
                    throw invalidBatch();
                }
            }
        }
        if (ids.isEmpty()) throw invalidBatch();
        return List.copyOf(ids);
    }

    private static IllegalArgumentException invalidBatch() {
        return new IllegalArgumentException("Liste des interventions à payer invalide");
    }
}
