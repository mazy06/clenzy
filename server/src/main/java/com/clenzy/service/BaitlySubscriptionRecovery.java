package com.clenzy.service;

import com.clenzy.repository.BaitlySubscriptionOrderRepository;
import com.clenzy.payment.StripeGateway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import java.util.Set;

/** Relecture bornée et reprise des changements expressément confirmés, sans nouvel encaissement. */
@Service
public class BaitlySubscriptionRecovery {
    private static final Logger log=LoggerFactory.getLogger(BaitlySubscriptionRecovery.class);
    private final BaitlySubscriptionOrderRepository orders;
    private final BaitlyMonthlySubscriptionService subscriptions;
    private final BaitlySubscriptionBilling billing;
    private final StripeGateway stripe;
    private final InscriptionService inscriptions;
    private final BaitlySubscriptionAmendments amendments;
    private long cursor;
    public BaitlySubscriptionRecovery(BaitlySubscriptionOrderRepository orders,BaitlyMonthlySubscriptionService subscriptions,
            BaitlySubscriptionBilling billing,StripeGateway stripe,InscriptionService inscriptions,BaitlySubscriptionAmendments amendments) {
        this.amendments=amendments;
        this.orders=orders;this.subscriptions=subscriptions;this.billing=billing;this.stripe=stripe;this.inscriptions=inscriptions;
    }
    public synchronized void sweep() {
        var batch=orders.recoveryBatch(cursor,PageRequest.of(0,25));
        if(batch.isEmpty()){cursor=0;return;}
        for(var order:batch) {
            cursor=order.getId();
            try {
                if(order.getOrganizationId()==null) {
                    var session=stripe.retrieveSession(order.getCheckoutSessionId());
                    if("complete".equals(session.getStatus()) && Set.of("paid","no_payment_required").contains(session.getPaymentStatus()))
                        inscriptions.confirmPayment(session.getId(),session.getCustomer(),session.getSubscription());
                    else if("expired".equals(session.getStatus()) || order.getCreatedAt().plusHours(24).isBefore(java.time.LocalDateTime.now(java.time.Clock.systemUTC())))
                        inscriptions.expireInscription(session.getId());
                    continue;
                }
                billing.expirePaidAccess(order.getId(),order.getOrganizationId());
                if(Set.of("CHECKOUT_OPEN","ACTIVATING").contains(order.getStatus())) {
                    var session=stripe.retrieveSession(order.getCheckoutSessionId());
                    if("expired".equals(session.getStatus()))subscriptions.expire(session.getId());
                    else if("complete".equals(session.getStatus()) && Set.of("paid","no_payment_required").contains(session.getPaymentStatus())) {
                        subscriptions.complete(session.getId());billing.refresh(session.getSubscription());
                    }
                } else {
                    try { amendments.recover(order.getId(),order.getOrganizationId()); }
                    finally { billing.refresh(order.getStripeSubscriptionId()); }
                }
            } catch(Exception failure) {
                log.warn("Abonnement Baitly {} : rapprochement à reprendre ({})",order.getId(),failure.getClass().getSimpleName());
            }
        }
    }
}
