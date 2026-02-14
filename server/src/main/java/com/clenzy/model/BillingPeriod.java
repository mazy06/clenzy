package com.clenzy.model;

public enum BillingPeriod {
    MONTHLY(1, 1.0),
    ANNUAL(12, 0.80),
    BIENNIAL(24, 0.65);

    private final int months;
    private final double discount;

    BillingPeriod(int months, double discount) {
        this.months = months;
        this.discount = discount;
    }

    public int getMonths() { return months; }
    public double getDiscount() { return discount; }

    /** Calcule le prix mensuel effectif en centimes a partir d'un prix mensuel de base en centimes */
    public int computeMonthlyPriceCents(int baseMonthlyPriceCents) {
        return (int) Math.round(baseMonthlyPriceCents * discount);
    }

    /** Calcule le prix total de la periode en centimes */
    public int computeTotalPriceCents(int baseMonthlyPriceCents) {
        return computeMonthlyPriceCents(baseMonthlyPriceCents) * months;
    }

    public static BillingPeriod fromString(String value) {
        if (value == null || value.isBlank()) return MONTHLY;
        try {
            return BillingPeriod.valueOf(value.toUpperCase());
        } catch (IllegalArgumentException e) {
            return MONTHLY;
        }
    }
}
