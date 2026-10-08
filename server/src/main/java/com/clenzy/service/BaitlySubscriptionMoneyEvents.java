package com.clenzy.service;

import com.clenzy.model.User;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.ai.AiCreditGrantService;
import com.stripe.exception.StripeException;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Instant;
import java.util.*;

/** Routage canonique des événements de fonds et récupération bornée des contrats prépayés historiques. */
@Service
public class BaitlySubscriptionMoneyEvents {
    private final StripeGateway stripe;
    private final BaitlySubscriptionBilling billing;
    private final BaitlySubscriptionFunds funds;
    private final UserRepository users;
    private final AiCreditGrantService grants;
    private final EntityManager em;
    private final TransactionTemplate write;
    private long userCursor;
    private String invoiceCursor="";
    public BaitlySubscriptionMoneyEvents(StripeGateway stripe,BaitlySubscriptionBilling billing,BaitlySubscriptionFunds funds,
            UserRepository users,AiCreditGrantService grants,EntityManager em,PlatformTransactionManager tx) {
        this.stripe=stripe;this.billing=billing;this.funds=funds;this.users=users;this.grants=grants;this.em=em;write=new TransactionTemplate(tx);
    }
    public boolean charge(String chargeId)throws StripeException {
        var charge=stripe.retrieveCharge(chargeId);if(charge.getPaymentIntent()==null)return false;
        var invoices=stripe.invoicePayments(null,charge.getPaymentIntent()).stream().map(com.stripe.model.InvoicePayment::getInvoice).filter(Objects::nonNull).distinct().toList();
        boolean known=false;for(String invoice:invoices)known|=invoice(invoice);return known;
    }
    public boolean invoice(String id)throws StripeException {
        if(billing.invoice(id))return true;
        var invoice=stripe.retrieveInvoice(id);String subscription=BaitlySubscriptionBilling.subscriptionId(invoice);if(subscription==null)return false;
        var payer=users.findByStripeSubscriptionId(subscription).orElse(null);if(payer==null || payer.getOrganizationId()==null)return false;
        if(!"paid".equals(invoice.getStatus()))return true;
        var proof=funds.inspect(invoice);var end=BaitlySubscriptionBilling.paidPeriodEnd(invoice);
        write.executeWithoutResult(s->{grants.grantForPaidInvoice(subscription,invoice);funds.apply(payer.getOrganizationId(),invoice,proof,end);});return true;
    }
    public synchronized void recover() {
        List<User> legacy=write.execute(s->em.createQuery("from User where id>:cursor and stripeSubscriptionId is not null and billingPeriod in ('ANNUAL','BIENNIAL') order by id",User.class)
                .setParameter("cursor",userCursor).setMaxResults(20).getResultList());
        if(legacy.isEmpty())userCursor=0;
        for(var payer:legacy) {
            userCursor=payer.getId();try {var sub=stripe.retrieveSubscription(payer.getStripeSubscriptionId());if(sub.getLatestInvoice()!=null)invoice(sub.getLatestInvoice());}
            catch(Exception error){org.slf4j.LoggerFactory.getLogger(getClass()).warn("Couverture prépayée Baitly {} à rapprocher ({})",payer.getId(),error.getClass().getSimpleName());}
        }
        List<String> invoices=write.execute(s->em.createQuery("select f.invoiceId from BaitlySubscriptionFunding f where f.invoiceId>:cursor and f.periodEnd>:now order by f.invoiceId",String.class)
                .setParameter("cursor",invoiceCursor).setParameter("now",Instant.now()).setMaxResults(20).getResultList());
        if(invoices.isEmpty())invoiceCursor="";
        for(String id:invoices) {
            invoiceCursor=id;try {invoice(id);}catch(Exception error){org.slf4j.LoggerFactory.getLogger(getClass()).warn("Fonds d'abonnement Baitly à rapprocher ({})",error.getClass().getSimpleName());}
        }
    }
}
