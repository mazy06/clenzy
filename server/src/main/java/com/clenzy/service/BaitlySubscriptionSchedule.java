package com.clenzy.service;

import com.clenzy.model.BaitlySubscriptionOrder;
import com.clenzy.payment.StripeGateway;
import com.stripe.exception.StripeException;
import com.stripe.model.Subscription;
import org.springframework.stereotype.Service;
import java.util.*;

/** Installe les quatre phases Stripe ; la dernière est conservée après libération du calendrier. */
@Service
public class BaitlySubscriptionSchedule {
    private final StripeGateway stripe;
    public BaitlySubscriptionSchedule(StripeGateway stripe){this.stripe=stripe;}
    public void cancelAtPeriodEnd(BaitlySubscriptionOrder order,Subscription subscription) throws StripeException {
        if(subscription.getSchedule()==null) {
            stripe.updateSubscription(subscription,Map.of("cancel_at_period_end",true),"BAITLY-MONTHLY-CANCEL-"+order.getId());return;
        }
        var schedule=stripe.retrieveSubscriptionSchedule(subscription.getSchedule());
        if(!subscription.getId().equals(schedule.getSubscription())
                || !String.valueOf(order.getId()).equals(schedule.getMetadata()==null?null:schedule.getMetadata().get("baitly_order_id"))
                || schedule.getCurrentPhase()==null || subscription.getItems()==null || subscription.getItems().getData().size()!=1)
            throw new IllegalStateException("Échéancier à rapprocher avant résiliation");
        var item=subscription.getItems().getData().getFirst();
        if(item.getPrice()==null || item.getCurrentPeriodEnd()==null)throw new IllegalStateException("Échéance de fin absente");
        var phase=Map.of("start_date",schedule.getCurrentPhase().getStartDate(),"end_date",item.getCurrentPeriodEnd(),
                "items",List.of(Map.of("price",item.getPrice().getId(),"quantity",1)),
                "automatic_tax",Map.of("enabled",true),"proration_behavior","none");
        stripe.updateSubscriptionSchedule(schedule,Map.of("end_behavior","cancel","proration_behavior","none","phases",List.of(phase)),
                "BAITLY-MONTHLY-CANCEL-"+order.getId());
    }
    public String install(BaitlySubscriptionOrder order,Subscription subscription) throws StripeException {
        if(subscription.getItems()==null || subscription.getItems().getData().size()!=1)
            throw new IllegalStateException("Abonnement mensuel incompatible");
        var item=subscription.getItems().getData().getFirst();
        if(item.getPrice()==null || item.getPrice().getProduct()==null || !Long.valueOf(1L).equals(item.getQuantity())
                || !order.getCurrency().equalsIgnoreCase(item.getPrice().getCurrency()))
            throw new IllegalStateException("Ligne d'abonnement incompatible");
        var schedule=subscription.getSchedule()==null
                ? stripe.createSubscriptionSchedule(subscription.getId(),"BAITLY-SCHEDULE-"+order.getId())
                : stripe.retrieveSubscriptionSchedule(subscription.getSchedule());
        // Une reprise après le mois 4 ne doit jamais recommencer la fidélité au mois 1.
        if(schedule.getMetadata()!=null && schedule.getMetadata().containsKey("baitly_order_id")) {
            if(!subscription.getId().equals(schedule.getSubscription())
                    || !String.valueOf(order.getId()).equals(schedule.getMetadata().get("baitly_order_id")))
                throw new IllegalStateException("Calendrier appartenant à une autre commande");
            return schedule.getId();
        }
        if(!subscription.getId().equals(schedule.getSubscription()) || schedule.getCurrentPhase()==null
                || !Long.valueOf(order.firstRegularCents()).equals(item.getPrice().getUnitAmount()))
            throw new IllegalStateException("Calendrier d'abonnement incompatible");
        stripe.updateSubscriptionSchedule(schedule,parameters(order,item.getPrice().getProduct(),schedule.getCurrentPhase().getStartDate()),
                "BAITLY-SCHEDULE-PHASES-"+order.getId());
        return schedule.getId();
    }
    static Map<String,Object> parameters(BaitlySubscriptionOrder order,String product,long start) {
        List<Map<String,Object>> phases=new ArrayList<>();
        long[] amounts={order.getMonthOneCents(),order.getMonthFourCents(),order.getMonthSevenCents(),order.getMonthThirteenCents()};
        int[] ends={3,6,12,Integer.MAX_VALUE};
        int startMonth=order.getSubscriptionMonth();
        for(int i=0;i<ends.length;i++) {
            if(startMonth>ends[i])continue;
            Map<String,Object> phase=new LinkedHashMap<>();
            if(phases.isEmpty())phase.put("start_date",start);
            int duration=i==3?1:ends[i]-startMonth+1;
            phase.put("duration",Map.of("interval","month","interval_count",duration));
            phase.put("items",List.of(Map.of("quantity",1,"price_data",Map.of("product",product,"currency",order.getCurrency().toLowerCase(Locale.ROOT),
                    "unit_amount",amounts[i],"tax_behavior","exclusive","recurring",Map.of("interval","month")))));
            phase.put("automatic_tax",Map.of("enabled",true));
            phase.put("proration_behavior","none");
            phase.put("metadata",Map.of("baitly_order_id",String.valueOf(order.getId()),"priceVersion",order.getPriceVersion()));
            phases.add(phase);
            startMonth=ends[i]==Integer.MAX_VALUE?Integer.MAX_VALUE:ends[i]+1;
        }
        return Map.of("end_behavior","release","proration_behavior","none","phases",phases,
                "metadata",Map.of("baitly_order_id",String.valueOf(order.getId())));
    }
}
