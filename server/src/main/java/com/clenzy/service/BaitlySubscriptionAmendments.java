package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.model.BaitlySubscriptionAmendment.Terms;
import com.clenzy.repository.*;
import com.clenzy.payment.StripeGateway;
import com.stripe.model.Subscription;
import com.stripe.exception.StripeException;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.*;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.util.*;

/** Changement au prochain renouvellement : pas de second abonnement, pas de période facturée deux fois. */
@Service
public class BaitlySubscriptionAmendments {
    private final EntityManager em;
    private final BaitlyMonthlySubscriptionService monthly;
    private final BaitlySubscriptionOrderRepository orders;
    private final BaitlyMonthlyPricing pricing;
    private final PropertyRepository properties;
    private final StripeGateway stripe;
    private final TransactionTemplate write;
    public BaitlySubscriptionAmendments(EntityManager em,BaitlyMonthlySubscriptionService monthly,BaitlySubscriptionOrderRepository orders,
            BaitlyMonthlyPricing pricing,PropertyRepository properties,StripeGateway stripe,PlatformTransactionManager manager) {
        this.em=em;this.monthly=monthly;this.orders=orders;this.pricing=pricing;this.properties=properties;this.stripe=stripe;write=new TransactionTemplate(manager);
    }
    public record Proposal(Terms terms,long chargeNowCents,String reason) {}
    public record Change(Long id,UUID requestId,Terms terms,String status) {}

    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    public Proposal proposal(String subject,Long orderId,BaitlyMonthlyPricing.Plan plan)throws StripeException {
        var order=monthly.owned(subject,orderId);var sub=verified(order);
        var item=sub.getItems().getData().getFirst();
        require(item.getCurrentPeriodEnd()!=null && item.getCurrentPeriodEnd()>Instant.now().getEpochSecond(),"Échéance à rapprocher");
        int count=Math.toIntExact(Math.max(1,properties.countByOrganizationId(order.getOrganizationId())));
        require(!order.getPlan().equals(plan.name()) || order.getProperties()!=count,"Formule et quantité déjà en place");
        int month=Math.toIntExact(Math.max(0,java.time.temporal.ChronoUnit.MONTHS.between(YearMonth.from(order.getLoyaltyStartedAt()),
                YearMonth.from(LocalDateTime.ofInstant(Instant.ofEpochSecond(item.getCurrentPeriodEnd()),ZoneOffset.UTC))))+1);
        var market=BaitlyMonthlyPricing.Market.valueOf(order.getMarket());
        var terms=new Terms(plan.name(),count,order.getCurrency(),month,item.getCurrentPeriodEnd(),
                pricing.quote(plan,market,count,1).totalCents(),pricing.quote(plan,market,count,4).totalCents(),
                pricing.quote(plan,market,count,7).totalCents(),pricing.quote(plan,market,count,13).totalCents(),BaitlyMonthlyPricing.VERSION);
        return new Proposal(terms,0,"NEXT_RENEWAL_NO_PRORATION");
    }

    @Transactional(readOnly=true)
    public List<Change> list(String subject,Long orderId) {
        var order=monthly.owned(subject,orderId);
        return all(order).stream().map(BaitlySubscriptionAmendments::dto).toList();
    }

    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    public Change schedule(String subject,Long orderId,BaitlyMonthlyPricing.Plan plan,UUID requestId,Terms accepted)throws StripeException {
        require(requestId!=null && accepted!=null,"Proposition et identifiant de demande requis");
        var order=monthly.owned(subject,orderId);
        var previous=write.execute(s->all(order).stream().filter(c->c.getRequestId().equals(requestId)).findFirst().orElse(null));
        if(previous!=null) {
            require(previous.getTerms().equals(accepted) && accepted.plan().equals(plan.name()),"Cette demande correspond à une autre proposition");
            if("PREPARED".equals(previous.getStatus()))apply(order,previous);
            return dto(em.find(BaitlySubscriptionAmendment.class,previous.getId()));
        }
        var fresh=proposal(subject,orderId,plan);
        require(fresh.terms().equals(accepted),"Le tarif, les logements ou l'échéance ont changé : actualisez la proposition");
        var change=write.execute(s->{
            var locked=orders.lockByIdAndOrganizationId(orderId,order.getOrganizationId()).orElseThrow();
            require(!locked.isCancelAtPeriodEnd() && "ACTIVE".equals(locked.getStatus()),"Contrat non modifiable dans cet état");
            require(all(locked).stream().noneMatch(c->Set.of("PREPARED","SCHEDULED").contains(c.getStatus())),"Un changement est déjà en cours");
            require(accepted.properties()==Math.max(1,properties.countByOrganizationId(order.getOrganizationId())),"La liste des logements a changé");
            var c=new BaitlySubscriptionAmendment(order.getOrganizationId(),orderId,requestId,accepted);em.persist(c);em.flush();return c;
        });
        apply(order,change);return dto(em.find(BaitlySubscriptionAmendment.class,change.getId()));
    }

    /** Reprise d'une réponse perdue : lire les métadonnées avant de réémettre la même intention. */
    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    public void recover(Long orderId,Long org)throws StripeException {
        var order=orders.findByIdAndOrganizationId(orderId,org).orElseThrow();
        var pending=write.execute(s->all(order).stream().filter(c->"PREPARED".equals(c.getStatus())).findFirst().orElse(null));
        if(pending!=null)apply(order,pending);
    }

    private void apply(BaitlySubscriptionOrder order,BaitlySubscriptionAmendment change)throws StripeException {
        var sub=verified(order);
        var schedule=sub.getSchedule()==null?stripe.createSubscriptionSchedule(sub.getId(),"BAITLY-AMEND-SCHEDULE-"+change.getId())
                :stripe.retrieveSubscriptionSchedule(sub.getSchedule());
        require(Objects.equals(sub.getId(),schedule.getSubscription()) && schedule.getCurrentPhase()!=null,"Échéancier à rapprocher");
        require(schedule.getMetadata()==null || schedule.getMetadata().get("baitly_order_id")==null
                || order.getId().toString().equals(schedule.getMetadata().get("baitly_order_id")),"Échéancier d'un autre contrat");
        String marker=schedule.getMetadata()==null?null:schedule.getMetadata().get("baitly_change_id");
        if(!String.valueOf(change.getId()).equals(marker)) {
            require(change.getTerms().effectiveAt()>Instant.now().getEpochSecond(),"Échéance dépassée : changement à rapprocher");
            var item=sub.getItems().getData().getFirst();
            require(Objects.equals(item.getCurrentPeriodEnd(),change.getTerms().effectiveAt()),"L'échéance a changé");
            var next=shadow(order,change.getTerms());
            var parameters=new LinkedHashMap<>(BaitlySubscriptionSchedule.parameters(next,item.getPrice().getProduct(),change.getTerms().effectiveAt()));
            @SuppressWarnings("unchecked") var future=(List<Map<String,Object>>)parameters.get("phases");
            future.forEach(p->p.put("metadata",Map.of("baitly_order_id",order.getId().toString(),"baitly_change_id",change.getId().toString(),"priceVersion",change.getTerms().version())));
            var current=new LinkedHashMap<String,Object>();
            current.put("start_date",schedule.getCurrentPhase().getStartDate());current.put("end_date",change.getTerms().effectiveAt());
            current.put("items",List.of(Map.of("price",item.getPrice().getId(),"quantity",1)));
            current.put("automatic_tax",Map.of("enabled",true));current.put("proration_behavior","none");
            // Le coupon de première échéance ne doit pas disparaître de la phase en cours.
            if(sub.getDiscounts()!=null && !sub.getDiscounts().isEmpty())current.put("discounts",sub.getDiscounts().stream().map(d->Map.of("discount",d)).toList());
            var phases=new ArrayList<Map<String,Object>>();phases.add(current);phases.addAll(future);parameters.put("phases",phases);
            parameters.put("metadata",Map.of("baitly_order_id",order.getId().toString(),"baitly_change_id",change.getId().toString()));
            stripe.updateSubscriptionSchedule(schedule,parameters,"BAITLY-AMEND-"+change.getId());
        }
        write.executeWithoutResult(s->{orders.lockByIdAndOrganizationId(order.getId(),order.getOrganizationId()).orElseThrow();
            var c=em.find(BaitlySubscriptionAmendment.class,change.getId());if("PREPARED".equals(c.getStatus()))c.setStatus("SCHEDULED");});
    }

    /** Appelé sous le verrou du contrat, à partir de la facture canonique payée. */
    @Transactional(propagation=Propagation.MANDATORY)
    public void confirm(BaitlySubscriptionOrder order,com.stripe.model.Invoice invoice,Subscription sub) {
        var candidate=all(order).stream().filter(c->Set.of("PREPARED","SCHEDULED").contains(c.getStatus())).findFirst();
        if(candidate.isEmpty() || !"paid".equals(invoice.getStatus()) || !"subscription_cycle".equals(invoice.getBillingReason()))return;
        var c=candidate.get();var terms=c.getTerms();
        require(invoice.getLines()!=null && !Boolean.TRUE.equals(invoice.getLines().getHasMore()),"Lignes de facture incomplètes");
        var starts=invoice.getLines().getData().stream().filter(l->l.getPeriod()!=null && l.getPeriod().getStart()!=null)
                .map(l->l.getPeriod().getStart()).toList();
        if(starts.isEmpty() || starts.stream().anyMatch(start->start<terms.effectiveAt()))return;
        var details=invoice.getParent()==null?null:invoice.getParent().getSubscriptionDetails();
        require(details!=null && details.getMetadata()!=null && c.getId().toString().equals(details.getMetadata().get("baitly_change_id")),
                "Facture sans preuve du changement demandé");
        int month=Math.toIntExact(java.time.temporal.ChronoUnit.MONTHS.between(YearMonth.from(order.getLoyaltyStartedAt()),
                YearMonth.from(LocalDateTime.ofInstant(Instant.ofEpochSecond(Collections.min(starts)),ZoneOffset.UTC)))+1);
        long expected=month<=3?terms.monthOne():month<=6?terms.monthFour():month<=12?terms.monthSeven():terms.monthThirteen();
        require(Objects.equals(order.getStripeSubscriptionId(),sub.getId()) && Objects.equals(invoice.getSubtotal(),expected),
                "Facture de changement à rapprocher");
        copy(order,terms);c.setStatus("APPLIED");c.setAppliedInvoiceId(invoice.getId());
    }

    @Transactional
    public void cancelled(String subject,Long id) {
        var owned=monthly.owned(subject,id);var order=orders.lockByIdAndOrganizationId(id,owned.getOrganizationId()).orElseThrow();
        require(order.isCancelAtPeriodEnd(),"Résiliation non confirmée");
        all(order).stream().filter(c->Set.of("PREPARED","SCHEDULED").contains(c.getStatus())).forEach(c->c.setStatus("CANCELLED"));
    }

    private Subscription verified(BaitlySubscriptionOrder order)throws StripeException {
        stripe.verifySubscriptionSeller(order.getSellerCountry(),order.getSellerStripeAccountId());
        require("ACTIVE".equals(order.getStatus()) && !order.isCancelAtPeriodEnd(),"Contrat non modifiable dans cet état");
        require(order.getPaidUntil()!=null && order.getPaidUntil().isAfter(Instant.now()) && order.getLoyaltyStartedAt()!=null,
                "Échéance payée à rapprocher avant de changer le contrat");
        var sub=stripe.retrieveSubscription(order.getStripeSubscriptionId());
        require("active".equals(sub.getStatus()) && !Boolean.TRUE.equals(sub.getCancelAtPeriodEnd()) && sub.getPendingUpdate()==null
                && Objects.equals(order.getStripeCustomerId(),sub.getCustomer()) && sub.getItems()!=null && sub.getItems().getData().size()==1,
                "Abonnement ou paiement en attente de rapprochement");
        var item=sub.getItems().getData().getFirst();
        require(item.getPrice()!=null && item.getPrice().getProduct()!=null && Long.valueOf(1).equals(item.getQuantity())
                && order.getCurrency().equalsIgnoreCase(item.getPrice().getCurrency()),"Tarif du contrat incohérent");return sub;
    }
    private List<BaitlySubscriptionAmendment> all(BaitlySubscriptionOrder order) {
        return em.createQuery("from BaitlySubscriptionAmendment where organizationId=:org and orderId=:id order by id desc",BaitlySubscriptionAmendment.class)
                .setParameter("org",order.getOrganizationId()).setParameter("id",order.getId()).getResultList();
    }
    private static BaitlySubscriptionOrder shadow(BaitlySubscriptionOrder order,Terms terms) {
        var copy=new BaitlySubscriptionOrder();copy.setCurrency(order.getCurrency());copy(copy,terms);return copy;
    }
    private static void copy(BaitlySubscriptionOrder order,Terms t) {
        order.setPlan(t.plan());order.setProperties(t.properties());order.setSubscriptionMonth(t.subscriptionMonth());order.setPriceVersion(t.version());
        order.setMonthOneCents(t.monthOne());order.setMonthFourCents(t.monthFour());order.setMonthSevenCents(t.monthSeven());order.setMonthThirteenCents(t.monthThirteen());
    }
    private static Change dto(BaitlySubscriptionAmendment c){return new Change(c.getId(),c.getRequestId(),c.getTerms(),c.getStatus());}
    private static void require(boolean value,String message){if(!value)throw new IllegalStateException(message);}
}
