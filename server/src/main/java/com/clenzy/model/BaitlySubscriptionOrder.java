package com.clenzy.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

/** Engagement SaaS versionné ; le retour navigateur ne l'active jamais. */
@Entity
@Table(name="baitly_subscription_orders")
public class BaitlySubscriptionOrder {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="organization_id") private Long organizationId;
    @Column(name="payer_user_id") private Long payerUserId;
    @Column(name="signup_id",unique=true) private Long signupId;
    @Column(name="request_id",nullable=false) private UUID requestId;
    @Column(nullable=false,length=20) private String plan;
    @Column(nullable=false,length=4) private String market;
    @Column(nullable=false,length=3) private String currency;
    @Column(name="billing_country",length=2) private String billingCountry;
    @Column(name="seller_country",length=2) private String sellerCountry;
    @Column(name="seller_stripe_account_id") private String sellerStripeAccountId;
    public String getBillingCountry(){return billingCountry;}
    public void setBillingCountry(String value){billingCountry=value;}
    public String getSellerCountry(){return sellerCountry;}
    public void setSellerCountry(String value){sellerCountry=value;}
    public String getSellerStripeAccountId(){return sellerStripeAccountId;}
    public void setSellerStripeAccountId(String value){sellerStripeAccountId=value;}
    @Column(nullable=false) private int properties;
    @Column(name="price_version",nullable=false,length=50) private String priceVersion;
    @Column(name="month_one_cents",nullable=false) private long monthOneCents;
    @Column(name="month_four_cents",nullable=false) private long monthFourCents;
    @Column(name="month_seven_cents",nullable=false) private long monthSevenCents;
    @Column(name="month_thirteen_cents",nullable=false) private long monthThirteenCents;
    @Column(nullable=false,length=32) private String status="PREPARED";
    @Column(name="checkout_session_id",unique=true) private String checkoutSessionId;
    @Column(name="checkout_url",columnDefinition="text") private String checkoutUrl;
    @Column(name="stripe_subscription_id",unique=true) private String stripeSubscriptionId;
    @Column(name="stripe_customer_id") private String stripeCustomerId;
    @Column(name="previous_subscription_id") private String previousSubscriptionId;
    @Column(name="stripe_schedule_id") private String stripeScheduleId;
    @Column(name="created_at",nullable=false) private LocalDateTime createdAt=LocalDateTime.now(java.time.Clock.systemUTC());
    @Column(name="activated_at") private LocalDateTime activatedAt;
    @Column(name="first_invoice_cents",nullable=false) private long firstInvoiceCents;
    @Column(name="promo_code_id") private Long promoCodeId;
    @Column(name="promo_code",length=50) private String promoCode;
    @Column(name="last_invoice_id") private String lastInvoiceId;
    @Column(name="paid_until") private java.time.Instant paidUntil;
    @Column(name="cancel_at_period_end",nullable=false) private boolean cancelAtPeriodEnd;
    @Column(name="subscription_month",nullable=false) private int subscriptionMonth=1;
    @Column(name="loyalty_started_at",nullable=false) private LocalDateTime loyaltyStartedAt=LocalDateTime.now(java.time.Clock.systemUTC());
    public Long getId(){return id;}
    public Long getSignupId(){return signupId;} public void setSignupId(Long value){signupId=value;}
    public Long getOrganizationId(){return organizationId;} public void setOrganizationId(Long value){organizationId=value;}
    public Long getPayerUserId(){return payerUserId;} public void setPayerUserId(Long value){payerUserId=value;}
    public UUID getRequestId(){return requestId;} public void setRequestId(UUID value){requestId=value;}
    public String getPlan(){return plan;} public void setPlan(String value){plan=value;}
    public String getMarket(){return market;} public void setMarket(String value){market=value;}
    public String getCurrency(){return currency;} public void setCurrency(String value){currency=value;}
    public int getProperties(){return properties;} public void setProperties(int value){properties=value;}
    public String getPriceVersion(){return priceVersion;} public void setPriceVersion(String value){priceVersion=value;}
    public long getMonthOneCents(){return monthOneCents;} public void setMonthOneCents(long value){monthOneCents=value;}
    public long getMonthFourCents(){return monthFourCents;} public void setMonthFourCents(long value){monthFourCents=value;}
    public long getMonthSevenCents(){return monthSevenCents;} public void setMonthSevenCents(long value){monthSevenCents=value;}
    public long getMonthThirteenCents(){return monthThirteenCents;} public void setMonthThirteenCents(long value){monthThirteenCents=value;}
    public String getStatus(){return status;} public void setStatus(String value){status=value;}
    public String getCheckoutSessionId(){return checkoutSessionId;} public void setCheckoutSessionId(String value){checkoutSessionId=value;}
    public String getCheckoutUrl(){return checkoutUrl;} public void setCheckoutUrl(String value){checkoutUrl=value;}
    public String getStripeSubscriptionId(){return stripeSubscriptionId;} public void setStripeSubscriptionId(String value){stripeSubscriptionId=value;}
    public String getStripeCustomerId(){return stripeCustomerId;} public void setStripeCustomerId(String value){stripeCustomerId=value;}
    public String getPreviousSubscriptionId(){return previousSubscriptionId;} public void setPreviousSubscriptionId(String value){previousSubscriptionId=value;}
    public String getStripeScheduleId(){return stripeScheduleId;} public void setStripeScheduleId(String value){stripeScheduleId=value;}
    public LocalDateTime getCreatedAt(){return createdAt;}
    public LocalDateTime getActivatedAt(){return activatedAt;} public void setActivatedAt(LocalDateTime value){activatedAt=value;}
    public long getFirstInvoiceCents(){return firstInvoiceCents;} public void setFirstInvoiceCents(long value){firstInvoiceCents=value;}
    public Long getPromoCodeId(){return promoCodeId;} public void setPromoCodeId(Long value){promoCodeId=value;}
    public String getPromoCode(){return promoCode;} public void setPromoCode(String value){promoCode=value;}
    public String getLastInvoiceId(){return lastInvoiceId;} public void setLastInvoiceId(String value){lastInvoiceId=value;}
    public java.time.Instant getPaidUntil(){return paidUntil;} public void setPaidUntil(java.time.Instant value){paidUntil=value;}
    public boolean isCancelAtPeriodEnd(){return cancelAtPeriodEnd;} public void setCancelAtPeriodEnd(boolean value){cancelAtPeriodEnd=value;}
    public int getSubscriptionMonth(){return subscriptionMonth;} public void setSubscriptionMonth(int value){subscriptionMonth=value;}
    public LocalDateTime getLoyaltyStartedAt(){return loyaltyStartedAt;} public void setLoyaltyStartedAt(LocalDateTime value){loyaltyStartedAt=value;}
    public long firstRegularCents(){return subscriptionMonth<=3?monthOneCents:subscriptionMonth<=6?monthFourCents:subscriptionMonth<=12?monthSevenCents:monthThirteenCents;}
}
