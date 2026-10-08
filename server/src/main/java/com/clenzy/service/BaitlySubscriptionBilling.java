package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.payment.StripeGateway;
import com.clenzy.service.ai.AiCreditGrantService;
import com.stripe.exception.StripeException;
import com.stripe.model.Invoice;
import com.stripe.model.Subscription;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Instant;
import java.util.*;

/** Les événements ne sont que des signaux : les factures et l'état d'abonnement sont relus chez Stripe. */
@Service
public class BaitlySubscriptionBilling {
    private final StripeGateway stripe;
    private final BaitlySubscriptionOrderRepository orders;
    private final BaitlySubscriptionInvoiceRepository invoices;
    private final OrganizationRepository organizations;
    private final BaitlyMonthlySubscriptionService monthly;
    private final AiCreditGrantService credits;
    private final OrganizationMemberRepository members;
    private final UserRepository users;
    private final BaitlySubscriptionAmendments amendments;
    private final BaitlySubscriptionFunds funds;
    private final TransactionTemplate write;
    public BaitlySubscriptionBilling(StripeGateway stripe,BaitlySubscriptionOrderRepository orders,
            BaitlySubscriptionInvoiceRepository invoices,OrganizationRepository organizations,
            BaitlyMonthlySubscriptionService monthly,AiCreditGrantService credits,OrganizationMemberRepository members,
            UserRepository users,PlatformTransactionManager tx,BaitlySubscriptionAmendments amendments,BaitlySubscriptionFunds funds) {
        this.funds=funds;
        this.amendments=amendments;
        this.stripe=stripe;this.orders=orders;this.invoices=invoices;this.organizations=organizations;
        this.monthly=monthly;this.credits=credits;this.members=members;this.users=users;this.write=new TransactionTemplate(tx);
    }

    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    public void refresh(String subscriptionId) throws StripeException {
        if(subscriptionId==null)return;
        var sub=stripe.retrieveSubscription(subscriptionId);
        if(sub.getLatestInvoice()!=null)invoice(sub.getLatestInvoice());
        subscription(subscriptionId);
    }

    /** Une indisponibilité du PSP ne prolonge pas un droit dont la date payée est déjà dépassée. */
    public void expirePaidAccess(Long id,Long organizationId) {
        write.executeWithoutResult(status->{
            var order=orders.lockByIdAndOrganizationId(id,organizationId).orElseThrow();
            if(order.getPaidUntil()==null || order.getPaidUntil().isAfter(Instant.now()))return;
            var org=organizations.lockById(organizationId).orElseThrow();
            if(!Objects.equals(org.getStripeSubscriptionId(),order.getStripeSubscriptionId()))return;
            org.setForfait("inactive");organizations.save(org);syncMemberAccess(org);
            if("CANCELLED".equals(order.getStatus())){order.setStatus("ENDED");orders.save(order);}
        });
    }

    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    public boolean invoice(String invoiceId) throws StripeException {
        Invoice invoice=stripe.retrieveInvoice(invoiceId);
        String subscriptionId=subscriptionId(invoice);
        if(subscriptionId==null)return false;
        Subscription subscription=stripe.retrieveSubscription(subscriptionId);
        var pending=find(subscription);
        if(pending==null)return false;
        stripe.verifySubscriptionSeller(pending.getSellerCountry(),pending.getSellerStripeAccountId());
        // Le compte n'existe pas encore ; son contrat payé sera rattaché après confirmation de l'email.
        if(pending.getOrganizationId()==null)return true;
        if(Set.of("CHECKOUT_OPEN","ACTIVATING").contains(pending.getStatus())) {
            if(!"paid".equals(invoice.getStatus()))return true;
            monthly.complete(pending.getCheckoutSessionId());
        }
        var order=orders.findById(pending.getId()).orElseThrow();
        verifyInvoice(order,invoice,subscription);
        var periodEnd=paidPeriodEnd(invoice);
        var funding="paid".equals(invoice.getStatus())?funds.inspect(invoice):null;
        write.executeWithoutResult(status->{
            var locked=orders.lockByIdAndOrganizationId(order.getId(),order.getOrganizationId()).orElseThrow();
            amendments.confirm(locked,invoice,subscription);
            var copy=invoices.findById(invoiceId).orElseGet(BaitlySubscriptionInvoice::new);
            if(copy.getOrderId()!=null && !copy.getOrderId().equals(locked.getId()))
                throw new IllegalStateException("Facture déjà rattachée à un autre contrat");
            copy.setInvoiceId(invoiceId);copy.setOrganizationId(locked.getOrganizationId());copy.setOrderId(locked.getId());
            copy.setStatus(invoice.getStatus());copy.setCurrency(invoice.getCurrency().toUpperCase(Locale.ROOT));
            copy.setTotalCents(invoice.getTotal());copy.setExcludingTaxCents(invoice.getTotalExcludingTax());
            copy.setPaidCents(invoice.getAmountPaid());copy.setRemainingCents(invoice.getAmountRemaining());
            copy.setHostedUrl(stripeUrl(invoice.getHostedInvoiceUrl()));copy.setPdfUrl(stripeUrl(invoice.getInvoicePdf()));
            copy.setIssuedAt(Instant.ofEpochSecond(invoice.getCreated()));invoices.save(copy);
            if("paid".equals(invoice.getStatus()) && periodEnd!=null) {
                if(locked.getPaidUntil()==null || periodEnd.isAfter(locked.getPaidUntil())) {
                    locked.setPaidUntil(periodEnd);locked.setLastInvoiceId(invoiceId);
                }
                var org=organizations.lockById(locked.getOrganizationId()).orElseThrow();
                // Une échéance de l'ancien contrat reste consultable, mais ne recharge pas la formule qui l'a remplacé.
                if(Objects.equals(org.getStripeSubscriptionId(),subscription.getId()))
                    credits.grantForVerifiedInvoice(locked.getOrganizationId(),"pro".equals(locked.getPlan())?"premium":"essentiel",invoiceId,periodEnd);
            }
            if(funding!=null) {
                funds.apply(locked.getOrganizationId(),invoice,funding,periodEnd);
                locked.setPaidUntil(funds.paidUntil(locked.getOrganizationId(),subscription.getId()));
            }
            applyState(locked,subscription);
        });
        return true;
    }

    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    public void subscription(String subscriptionId) throws StripeException {
        var subscription=stripe.retrieveSubscription(subscriptionId);var order=find(subscription);if(order==null)return;
        stripe.verifySubscriptionSeller(order.getSellerCountry(),order.getSellerStripeAccountId());
        if(order.getOrganizationId()==null)return;
        // Une facture tardive ne doit pas contourner l'activation du contrat et de son échéancier.
        if(Set.of("PREPARED","CHECKOUT_OPEN","ACTIVATING").contains(order.getStatus()))return;
        write.executeWithoutResult(status->{var locked=orders.lockByIdAndOrganizationId(order.getId(),order.getOrganizationId()).orElseThrow();applyState(locked,subscription);});
    }

    private BaitlySubscriptionOrder find(Subscription subscription) {
        var known=orders.findByStripeSubscriptionId(subscription.getId());
        if(known.isPresent())return known.get();
        var metadata=subscription.getMetadata();
        if(metadata==null || !BaitlyMonthlySubscriptionService.TYPE.equals(metadata.get("type")))return null;
        var order=orders.findById(Long.valueOf(metadata.get("baitly_order_id")))
                .orElseThrow(()->new IllegalStateException("Contrat mensuel absent"));
        require(String.valueOf(order.getOrganizationId()).equals(metadata.get("orgId")),"Organisation Stripe incompatible");
        return order;
    }

    private void applyState(BaitlySubscriptionOrder order,Subscription subscription) {
        require(Objects.equals(order.getStripeCustomerId(),subscription.getCustomer())
                && Objects.equals(order.getStripeSubscriptionId(),subscription.getId()),"Abonnement étranger au contrat");
        var org=organizations.lockById(order.getOrganizationId()).orElseThrow();
        if(!Objects.equals(org.getStripeSubscriptionId(),subscription.getId())) {
            order.setStatus("REPLACED");orders.save(order);return;
        }
        String state=switch(subscription.getStatus()) {
            case "active" -> "ACTIVE";
            case "past_due" -> "PAST_DUE";
            case "canceled" -> "CANCELLED";
            case "unpaid","paused","incomplete_expired" -> "SUSPENDED";
            default -> "REVIEW_REQUIRED";
        };
        order.setStatus(state);order.setCancelAtPeriodEnd(Boolean.TRUE.equals(subscription.getCancelAtPeriodEnd()) || subscription.getCancelAt()!=null);
        // Les données restent consultables ; la formule payante est retirée à la fin du droit payé.
        boolean entitled=order.getPaidUntil()!=null && order.getPaidUntil().isAfter(Instant.now());
        if("CANCELLED".equals(state) && !entitled)order.setStatus("ENDED");
        org.setForfait(entitled ? ("pro".equals(order.getPlan())?"premium":"essentiel") : "inactive");
        organizations.save(org);orders.save(order);syncMemberAccess(org);
    }

    private void syncMemberAccess(Organization org) {
        for(var member:members.findByOrganizationIdWithUser(org.getId())) {
            var user=member.getUser();
            if(Objects.equals(user.getOrganizationId(),org.getId())) {
                user.setForfait(org.getForfait());users.save(user);
            }
        }
    }

    static void verifyInvoice(BaitlySubscriptionOrder order,Invoice invoice,Subscription subscription) {
        require(invoice.getId()!=null && Objects.equals(subscriptionId(invoice),subscription.getId())
                && Objects.equals(order.getStripeCustomerId(),invoice.getCustomer())
                && Objects.equals(subscription.getCustomer(),invoice.getCustomer())
                && order.getCurrency().equalsIgnoreCase(invoice.getCurrency())
                && invoice.getTotal()!=null && invoice.getTotal()>=0 && invoice.getTotalExcludingTax()!=null
                && invoice.getAmountPaid()!=null && invoice.getAmountPaid()>=0
                && invoice.getAmountRemaining()!=null && invoice.getAmountRemaining()>=0 && invoice.getCreated()!=null
                && (invoice.getAmountPaidOffStripe()==null || invoice.getAmountPaidOffStripe()==0),
                "Facture d'abonnement à rapprocher");
        if("paid".equals(invoice.getStatus()))require(invoice.getAmountRemaining()==0,"Facture non soldée");
    }

    static Instant paidPeriodEnd(Invoice invoice) {
        if(!"paid".equals(invoice.getStatus()) || !Set.of("subscription_create","subscription_cycle").contains(invoice.getBillingReason()))return null;
        require(invoice.getLines()!=null && !Boolean.TRUE.equals(invoice.getLines().getHasMore()),"Période de facture incomplète");
        String subscription=subscriptionId(invoice);
        return invoice.getLines().getData().stream()
                .filter(line->line.getParent()!=null && line.getParent().getSubscriptionItemDetails()!=null)
                .filter(line->Objects.equals(subscription,line.getParent().getSubscriptionItemDetails().getSubscription())
                        && !Boolean.TRUE.equals(line.getParent().getSubscriptionItemDetails().getProration()))
                .filter(line->line.getPeriod()!=null && line.getPeriod().getEnd()!=null)
                .map(line->Instant.ofEpochSecond(line.getPeriod().getEnd())).max(Comparator.naturalOrder())
                .orElseThrow(()->new IllegalStateException("Période de facture absente"));
    }
    public static String subscriptionId(Invoice invoice) {
        return invoice.getParent()!=null && invoice.getParent().getSubscriptionDetails()!=null
                ?invoice.getParent().getSubscriptionDetails().getSubscription():null;
    }
    static String stripeUrl(String raw) {
        if(raw==null)return null;
        try {var uri=java.net.URI.create(raw);String host=uri.getHost();
            if("https".equals(uri.getScheme()) && uri.getUserInfo()==null && host!=null
                    && (host.equals("stripe.com") || host.endsWith(".stripe.com")))return raw;
        }catch(IllegalArgumentException ignored){}
        throw new IllegalStateException("Lien de facture Stripe inattendu");
    }
    private static void require(boolean condition,String message){if(!condition)throw new IllegalStateException(message);}
}
