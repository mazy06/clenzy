package com.clenzy.service;

import java.util.Locale;

/** Pays du client SaaS, indépendant de la localisation de son portefeuille immobilier. */
public final class BaitlyBillingCountry {
    private BaitlyBillingCountry() {}

    public static String normalize(String value) {
        String code=value==null?"":value.trim().toUpperCase(Locale.ROOT);
        code=switch(code){case "FRA"->"FR";case "MAR"->"MA";case "SAU"->"SA";default->code;};
        if(code.length()!=2)throw new IllegalArgumentException("Renseignez le pays de facturation du client");
        BaitlyMonthlyPricing.marketForCountry(code);
        return code;
    }

    /** Les clients du marché européen relèvent de l'exploitation française, jamais de la holding. */
    public static String sellerCountry(String billingCountry) {
        return switch(BaitlyMonthlyPricing.marketForCountry(normalize(billingCountry))) {
            case EU -> "FR";
            case MA -> "MA";
            case SA -> "SA";
        };
    }
}
