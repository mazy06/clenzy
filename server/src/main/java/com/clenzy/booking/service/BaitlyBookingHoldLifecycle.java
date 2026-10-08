package com.clenzy.booking.service;

import com.clenzy.model.*;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.service.CalendarEngine;
import jakarta.persistence.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Objects;

/** Un échec réseau n'est jamais une preuve que le voyageur n'a pas payé. */
@Service
public class BaitlyBookingHoldLifecycle {
    private final EntityManager em;
    private final PaymentTransactionRepository payments;
    private final CalendarEngine calendar;
    public BaitlyBookingHoldLifecycle(EntityManager em, PaymentTransactionRepository payments, CalendarEngine calendar) {
        this.em=em;this.payments=payments;this.calendar=calendar;
    }

    @Transactional
    public void attach(Long id, String session) {
        if (session == null || session.isBlank()) throw new IllegalArgumentException("Session de paiement absente");
        var stay=lock(id);
        if (Objects.equals(stay.getStripeSessionId(),session)) return;
        if (stay.getStripeSessionId()!=null || !"pending".equalsIgnoreCase(stay.getStatus()) || stay.getCancelledAt()!=null
                || stay.getPaidAt()!=null || stay.getPaymentStatus()==null
                || !java.util.Set.of(PaymentStatus.PENDING,PaymentStatus.PROCESSING,PaymentStatus.FAILED).contains(stay.getPaymentStatus()))
            throw new IllegalStateException("Le séjour ou sa session a changé : rapprochement requis");
        var matching=payments.findByOrganizationIdAndSourceTypeAndSourceId(stay.getOrganizationId(),"BOOKING_CHECKOUT",id).stream()
            .filter(p->p.getPaymentType()==TransactionType.CHECKOUT && session.equals(p.getProviderTxId())).toList();
        if (matching.size()!=1 || matching.getFirst().getStatus()!=TransactionStatus.PROCESSING
                && matching.getFirst().getStatus()!=TransactionStatus.COMPLETED)
            throw new IllegalStateException("Session sans intention de paiement correspondante");
        stay.setStripeSessionId(session);
    }

    /** Seuls les échecs AVANT toute intention PSP peuvent libérer immédiatement les dates. */
    @Transactional
    public void releaseIfNotStarted(Long id) {
        var stay=lock(id);
        if (!"pending".equalsIgnoreCase(stay.getStatus()) || stay.getStripeSessionId()!=null || stay.getPaidAt()!=null
                || stay.getAmountPaid()!=null && stay.getAmountPaid().signum()>0
                || stay.getPaymentStatus()!=PaymentStatus.PENDING && stay.getPaymentStatus()!=PaymentStatus.FAILED) return;
        for (String source:List.of("RESERVATION","BOOKING_CHECKOUT","BOOKING_BALANCE"))
            if (!payments.findByOrganizationIdAndSourceTypeAndSourceId(stay.getOrganizationId(),source,id).isEmpty()) return;
        stay.markCancelled();stay.setPaymentStatus(PaymentStatus.CANCELLED);
        calendar.cancel(id,stay.getOrganizationId(),"booking-engine-embedded-rollback");
    }

    private Reservation lock(Long id) {
        var stay=em.find(Reservation.class,id,LockModeType.PESSIMISTIC_WRITE);
        if(stay==null)throw new IllegalArgumentException("Réservation introuvable");
        em.refresh(stay,LockModeType.PESSIMISTIC_WRITE);return stay;
    }

    /** Une confirmation utilise le dossier et l'intention enregistrés, jamais les seules métadonnées du webhook. */
    @Transactional
    public Reservation confirmable(com.stripe.model.checkout.Session session) {
        var payment=payments.findByProviderTxId(session.getId()).orElseThrow(()->new IllegalStateException("Ancien encaissement sans dossier : rapprochement requis"));
        if(!"BOOKING_CHECKOUT".equals(payment.getSourceType()) || payment.getSourceId()==null)
            throw new IllegalStateException("Origine du paiement de séjour incohérente");
        var stay=lock(payment.getSourceId());
        em.refresh(payment,LockModeType.PESSIMISTIC_WRITE);
        boolean bad=payment.getPaymentType()!=TransactionType.CHECKOUT || payment.getStatus()!=TransactionStatus.COMPLETED
                || payment.getProviderType()!=PaymentProviderType.STRIPE || payment.hasDisputeRisk()
                || !Objects.equals(stay.getOrganizationId(),payment.getOrganizationId())
                || !Objects.equals(stay.getCurrency(),payment.getCurrency()) || payment.getAmount()==null
                || !"complete".equals(session.getStatus()) || !"paid".equals(session.getPaymentStatus())
                || !Objects.equals(com.clenzy.payment.StripeAmounts.toMinorUnits(payment.getAmount()),session.getAmountTotal())
                || !payment.getCurrency().equalsIgnoreCase(session.getCurrency())
                || stay.getCancelledAt()!=null || "cancelled".equalsIgnoreCase(stay.getStatus()) || "canceled".equalsIgnoreCase(stay.getStatus())
                || stay.getStripeSessionId()!=null && !session.getId().equals(stay.getStripeSessionId());
        if(bad)throw new IllegalStateException("Paiement du séjour à rapprocher avant confirmation");
        var md=payment.getMetadata();
        try {
            var balance=new java.math.BigDecimal(Objects.toString(md.get("deposit_balance"),"0"));
            var total=new java.math.BigDecimal(Objects.toString(md.get("server_total"),""));
            if(Boolean.TRUE.equals(md.get("reviewRequired")) || balance.signum()<0
                    || payment.getAmount().add(balance).compareTo(total)!=0
                    || total.compareTo(BaitlyReservationCredit.cash(stay))!=0
                    || session.getMetadata()==null || !Objects.equals(md.get("deposit_balance"),session.getMetadata().get("deposit_balance")))
                throw new IllegalStateException("Montant du séjour ou de l'acompte incohérent");
        }catch(NullPointerException|NumberFormatException error){throw new IllegalStateException("Montants du séjour à rapprocher",error);}
        stay.setStripeSessionId(session.getId());return stay;
    }
}
