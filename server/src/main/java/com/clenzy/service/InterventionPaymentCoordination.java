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

    public void lockPaymentMissions(Long orgId, PaymentOrchestrationRequest request) {
        var ids = missionIds(request);
        if (ids.isEmpty()) return;
        var missions = ids.stream().map(id -> lockMission(orgId, id)).toList();
        boolean direct = "INTERVENTION".equals(request.sourceType());
        boolean deposit = request.metadata() != null && "DEPOSIT".equalsIgnoreCase(request.metadata().get("purpose"));
        if (deposit && (!direct || ids.size() != 1)) throw new PaymentValidationException("Acompte groupé non pris en charge");
        BigDecimal total = BigDecimal.ZERO;
        LocalDate date = LocalDate.now();
        for (var mission : missions) {
            if (mission.getStatus() == InterventionStatus.CANCELLED
                    || (direct && mission.getStatus() == InterventionStatus.COMPLETED)
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
        }
        if (request.amount() == null || total.compareTo(request.amount()) != 0) {
            throw new PaymentValidationException("Le montant à payer a changé ; actualisez les missions");
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

    public void requireRefundOutsideCancellationCase(com.clenzy.model.PaymentTransaction payment) {
        Number count=(Number)em.createNativeQuery("""
            SELECT count(*) FROM service_quote_cancellations c LEFT JOIN interventions i ON i.id=c.intervention_id
            LEFT JOIN service_requests r ON r.id=i.service_request_id
            WHERE c.organization_id=:org AND (i.stripe_session_id=:session OR r.stripe_session_id=:session OR EXISTS (
              SELECT 1 FROM payment_transactions t WHERE t.id=:payment AND t.organization_id=c.organization_id AND (
                (t.source_type='INTERVENTION' AND (t.source_id=c.intervention_id OR cast(c.intervention_id AS text)=ANY(string_to_array(replace(t.metadata->>'interventionIds',' ',''),','))))
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
        boolean direct = "INTERVENTION".equals(request.sourceType());
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
