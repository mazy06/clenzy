package com.clenzy.service;

import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/** Grille publique Baitly 2026-10 : tranches marginales de volume puis fidélité, sans conversion FX. */
@Service
public class BaitlyMonthlyPricing {
    public static final String VERSION="2026-10-LOYALTY-1";
    public enum Plan { essential, pro }
    public enum Market { MA, EU, SA }
    public static Market marketForCountry(String raw) {
        String country=raw==null?"":raw.trim().toUpperCase(Locale.ROOT);
        if(Set.of("MA","MAR").contains(country))return Market.MA;
        if(Set.of("SA","SAU").contains(country))return Market.SA;
        if(Set.of("FR","BE","DE","ES","IT","PT","NL","LU","IE","AT","FI","GR","CY","MT","EE","LV","LT","SK","SI","HR").contains(country))return Market.EU;
        throw new IllegalArgumentException("Le tarif de ce pays nécessite un devis");
    }
    public record Band(int from, int to, int count, int discountPercent, long unitCents, long totalCents) {}
    public record Quote(String version, Plan plan, Market market, String currency, int properties,
            int subscriptionMonth, int loyaltyPercent, long baseCents, long volumeCents, long totalCents, List<Band> bands) {}
    public Quote quote(Plan plan, Market market, int properties, int month) {
        if(plan==null || market==null || properties<1 || properties>49 || month<1)
            throw new IllegalArgumentException("Formule, marché et 1 à 49 logements requis ; 50 logements et plus sur devis");
        long unit=switch(market) {
            case MA -> plan==Plan.essential ? 29000 : 49000;
            case EU -> plan==Plan.essential ? 2900 : 4900;
            case SA -> plan==Plan.essential ? 10900 : 18900;
        };
        String currency=switch(market) {case MA -> "MAD";case EU -> "EUR";case SA -> "SAR";};
        int[][] limits={{1,4,0},{5,9,10},{10,19,15},{20,49,20}};
        List<Band> bands=new ArrayList<>(); long volume=0;
        for(var tier:limits) {
            int count=Math.max(0,Math.min(properties,tier[1])-tier[0]+1);
            long discounted=discount(unit,tier[2]); long total=discounted*count;
            bands.add(new Band(tier[0],tier[1],count,tier[2],discounted,total)); volume+=total;
        }
        int loyalty=month<=3?0:month<=6?10:month<=12?20:30;
        return new Quote(VERSION,plan,market,currency,properties,month,loyalty,unit*properties,volume,discount(volume,loyalty),List.copyOf(bands));
    }
    private static long discount(long cents,int percent) {
        return BigDecimal.valueOf(cents).multiply(BigDecimal.valueOf(100-percent))
                .divide(BigDecimal.valueOf(100),0,RoundingMode.HALF_UP).longValueExact();
    }
}
