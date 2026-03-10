package com.clenzy.dto;

/**
 * Résumé de facturation PMS pour une organisation.
 * Calcul : total = basePriceCents + max(0, memberCount - freeSeats) × perSeatPriceCents
 */
public class BillingSummaryDto {

    private int memberCount;
    private int freeSeats;
    private int billableSeats;
    private int basePriceCents;
    private int perSeatPriceCents;
    private int seatsTotalCents;
    private int totalMonthlyCents;
    private String billingPeriod;
    private double billingPeriodDiscount;
    private int effectiveMonthlyCents;

    public BillingSummaryDto() {}

    public BillingSummaryDto(int memberCount, int freeSeats, int billableSeats,
                             int basePriceCents, int perSeatPriceCents,
                             int seatsTotalCents, int totalMonthlyCents,
                             String billingPeriod, double billingPeriodDiscount,
                             int effectiveMonthlyCents) {
        this.memberCount = memberCount;
        this.freeSeats = freeSeats;
        this.billableSeats = billableSeats;
        this.basePriceCents = basePriceCents;
        this.perSeatPriceCents = perSeatPriceCents;
        this.seatsTotalCents = seatsTotalCents;
        this.totalMonthlyCents = totalMonthlyCents;
        this.billingPeriod = billingPeriod;
        this.billingPeriodDiscount = billingPeriodDiscount;
        this.effectiveMonthlyCents = effectiveMonthlyCents;
    }

    // ─── Getters & Setters ─────────────────────────────────────────

    public int getMemberCount() { return memberCount; }
    public void setMemberCount(int memberCount) { this.memberCount = memberCount; }

    public int getFreeSeats() { return freeSeats; }
    public void setFreeSeats(int freeSeats) { this.freeSeats = freeSeats; }

    public int getBillableSeats() { return billableSeats; }
    public void setBillableSeats(int billableSeats) { this.billableSeats = billableSeats; }

    public int getBasePriceCents() { return basePriceCents; }
    public void setBasePriceCents(int basePriceCents) { this.basePriceCents = basePriceCents; }

    public int getPerSeatPriceCents() { return perSeatPriceCents; }
    public void setPerSeatPriceCents(int perSeatPriceCents) { this.perSeatPriceCents = perSeatPriceCents; }

    public int getSeatsTotalCents() { return seatsTotalCents; }
    public void setSeatsTotalCents(int seatsTotalCents) { this.seatsTotalCents = seatsTotalCents; }

    public int getTotalMonthlyCents() { return totalMonthlyCents; }
    public void setTotalMonthlyCents(int totalMonthlyCents) { this.totalMonthlyCents = totalMonthlyCents; }

    public String getBillingPeriod() { return billingPeriod; }
    public void setBillingPeriod(String billingPeriod) { this.billingPeriod = billingPeriod; }

    public double getBillingPeriodDiscount() { return billingPeriodDiscount; }
    public void setBillingPeriodDiscount(double billingPeriodDiscount) { this.billingPeriodDiscount = billingPeriodDiscount; }

    public int getEffectiveMonthlyCents() { return effectiveMonthlyCents; }
    public void setEffectiveMonthlyCents(int effectiveMonthlyCents) { this.effectiveMonthlyCents = effectiveMonthlyCents; }
}
