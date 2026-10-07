package com.clenzy.booking.service;

import java.math.*;
import java.util.Map;

/** Un même acompte arrondi au centime pour les parcours hébergé et intégré. */
public record BaitlyBookingPaymentPlan(BigDecimal total, BigDecimal now, BigDecimal balance) {
    public static BaitlyBookingPaymentPlan of(BigDecimal total, Integer percent) {
        if(total==null || total.signum()<=0)throw new IllegalArgumentException("Montant du séjour invalide");
        total=total.setScale(2,RoundingMode.UNNECESSARY);
        if(percent!=null && (percent<1 || percent>100))throw new IllegalArgumentException("Pourcentage d'acompte invalide");
        var now=percent==null?total:total.multiply(BigDecimal.valueOf(percent)).divide(BigDecimal.valueOf(100),2,RoundingMode.HALF_UP);
        if(now.signum()<=0)throw new IllegalArgumentException("Acompte inférieur au centime");
        return new BaitlyBookingPaymentPlan(total,now,total.subtract(now));
    }
    public Map<String,String> metadata() {return Map.of("server_total",total.toPlainString(),"deposit_balance",balance.toPlainString());}
}
