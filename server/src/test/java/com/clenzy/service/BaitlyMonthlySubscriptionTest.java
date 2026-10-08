package com.clenzy.service;

import com.clenzy.model.BaitlySubscriptionOrder;
import com.clenzy.payment.StripeGateway;
import com.stripe.model.*;
import com.stripe.model.checkout.Session;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyMonthlySubscriptionTest {
    static BaitlySubscriptionOrder order() {
        var order=new BaitlySubscriptionOrder();ReflectionTestUtils.setField(order,"id",5L);
        order.setOrganizationId(2L);order.setCurrency("EUR");order.setPlan("essential");order.setPriceVersion(BaitlyMonthlyPricing.VERSION);
        order.setMonthOneCents(2900);order.setFirstInvoiceCents(2400);order.setMonthFourCents(2610);order.setMonthSevenCents(2320);order.setMonthThirteenCents(2030);
        order.setCheckoutSessionId("cs_test");order.setStripeCustomerId("cus_test");order.setStripeSubscriptionId("sub_test");return order;
    }
    static Session paid() {
        return com.stripe.net.ApiResource.GSON.fromJson("""
                {"id":"cs_test","mode":"subscription","status":"complete","payment_status":"paid",
                 "customer":"cus_test","subscription":"sub_test","amount_subtotal":2900,"amount_total":2880,"currency":"eur",
                 "automatic_tax":{"enabled":true,"status":"complete"},"total_details":{"amount_discount":500,"amount_tax":480},
                 "metadata":{"type":"baitly_monthly_subscription","baitly_order_id":"5","orgId":"2","priceVersion":"2026-10-LOYALTY-1"}}
                """,Session.class);
    }
    @Test void verifiesExclusiveTaxAndOneTimePromotionSeparately(){assertThatCode(()->BaitlyMonthlySubscriptionService.verify(order(),paid())).doesNotThrowAnyException();}
    @Test void refusesGrossAmountThatDoesNotMatchDiscountedNetPlusTax() {
        var session=paid();session.setAmountTotal(2900L);
        assertThatThrownBy(()->BaitlyMonthlySubscriptionService.verify(order(),session)).hasMessageContaining("preuve");
    }
    @Test void refusesAnotherOrganizationEvenWithSameAmount() {
        var session=paid();session.getMetadata().put("orgId","3");
        assertThatThrownBy(()->BaitlyMonthlySubscriptionService.verify(order(),session)).isInstanceOf(IllegalStateException.class);
    }
    @Test void acceptsFullyDiscountedFirstInvoiceOnlyWithZeroTaxAndNoPaymentRequired() {
        var order=order();order.setFirstInvoiceCents(0);var session=paid();session.setPaymentStatus("no_payment_required");session.setAmountTotal(0L);
        session.getTotalDetails().setAmountDiscount(2900L);session.getTotalDetails().setAmountTax(0L);
        assertThatCode(()->BaitlyMonthlySubscriptionService.verify(order,session)).doesNotThrowAnyException();
        session.setAmountTotal(10L);assertThatThrownBy(()->BaitlyMonthlySubscriptionService.verify(order,session)).isInstanceOf(IllegalStateException.class);
    }
    @Test void refusesIncompleteTaxCalculation(){var session=paid();session.getAutomaticTax().setStatus("requires_location_inputs");assertThatThrownBy(()->BaitlyMonthlySubscriptionService.verify(order(),session)).isInstanceOf(IllegalStateException.class);}
    @Test void scheduleContainsThreeThreeSixMonthsThenPermanentLoyalty() {
        var params=BaitlySubscriptionSchedule.parameters(order(),"prod_test",1000);
        var phases=(List<Map<String,Object>>)params.get("phases");
        assertThat(phases).hasSize(4);assertThat(params.get("end_behavior")).isEqualTo("release");
        assertThat(phases.stream().map(p->(Integer)((Map<?,?>)p.get("duration")).get("interval_count"))).containsExactly(3,3,6,1);
        assertThat(phases.getFirst().get("start_date")).isEqualTo(1000L);
        assertThat(phases.get(1)).doesNotContainKey("start_date");
        assertThat(phases).allSatisfy(p->assertThat(p.get("automatic_tax")).isEqualTo(Map.of("enabled",true)));
    }
    @Test void retryAfterLoyaltyTransitionDoesNotResetSchedule() throws Exception {
        var stripe=mock(StripeGateway.class);var service=new BaitlySubscriptionSchedule(stripe);
        var subscription=com.stripe.net.ApiResource.GSON.fromJson("""
                {"id":"sub_test","schedule":"sub_sched_test","items":{"data":[{"quantity":1,"price":{"product":"prod_test","currency":"eur","unit_amount":2320}}]}}
                """,Subscription.class);
        var schedule=new SubscriptionSchedule();schedule.setId("sub_sched_test");schedule.setSubscription("sub_test");schedule.setMetadata(Map.of("baitly_order_id","5"));
        when(stripe.retrieveSubscriptionSchedule("sub_sched_test")).thenReturn(schedule);
        assertThat(service.install(order(),subscription)).isEqualTo("sub_sched_test");
        verify(stripe,never()).updateSubscriptionSchedule(any(),any(),any());
    }
    @Test void rejectsAnUnrelatedExistingSchedule() throws Exception {
        var stripe=mock(StripeGateway.class);var service=new BaitlySubscriptionSchedule(stripe);
        var sub=com.stripe.net.ApiResource.GSON.fromJson("{\"id\":\"sub_test\",\"schedule\":\"sched\",\"items\":{\"data\":[{\"quantity\":1,\"price\":{\"product\":\"prod\",\"currency\":\"eur\"}}]}}",Subscription.class);
        var schedule=new SubscriptionSchedule();schedule.setMetadata(Map.of("baitly_order_id","99"));when(stripe.retrieveSubscriptionSchedule("sched")).thenReturn(schedule);
        assertThatThrownBy(()->service.install(order(),sub)).hasMessageContaining("autre commande");
    }
    static Invoice invoice() {
        return com.stripe.net.ApiResource.GSON.fromJson("""
                {"id":"in_test","customer":"cus_test","currency":"eur","status":"paid","total":3480,"total_excluding_tax":2900,
                "amount_paid":3480,"amount_remaining":0,"amount_paid_off_stripe":0,"created":1800000000,
                "billing_reason":"subscription_cycle","parent":{"subscription_details":{"subscription":"sub_test"}},
                "lines":{"has_more":false,"data":[{"parent":{"subscription_item_details":{"subscription":"sub_test","proration":false}},"period":{"start":1800000000,"end":1802592000}}]}}
                """,Invoice.class);
    }
    @Test void onlyCanonicalPaidRecurringInvoicesGrantMonthlyCredits() {
        var invoice=invoice();var sub=new Subscription();sub.setId("sub_test");sub.setCustomer("cus_test");
        assertThatCode(()->BaitlySubscriptionBilling.verifyInvoice(order(),invoice,sub)).doesNotThrowAnyException();
        assertThat(BaitlySubscriptionBilling.paidPeriodEnd(invoice)).isNotNull();
        invoice.setBillingReason("subscription_update");assertThat(BaitlySubscriptionBilling.paidPeriodEnd(invoice)).isNull();
        invoice.setAmountPaidOffStripe(3480L);assertThatThrownBy(()->BaitlySubscriptionBilling.verifyInvoice(order(),invoice,sub)).hasMessageContaining("rapprocher");
    }
    @Test void hostedLinksMustRemainOnStripe() {
        assertThat(BaitlySubscriptionBilling.stripeUrl("https://invoice.stripe.com/i/test")).startsWith("https://invoice.stripe.com/");
        for(String url:List.of("javascript:alert(1)","https://stripe.com.attacker.example/","http://stripe.com/","https://user@stripe.com/"))
            assertThatThrownBy(()->BaitlySubscriptionBilling.stripeUrl(url)).isInstanceOf(IllegalStateException.class);
    }
    @Test void invoiceItemsAndProrationsDoNotExtendIncludedCredits() {
        var invoice=invoice();var recurring=invoice.getLines().getData().getFirst();
        var extra=new InvoiceLineItem();var period=new InvoiceLineItem.Period();period.setEnd(1999999999L);extra.setPeriod(period);
        invoice.getLines().setData(new ArrayList<>(List.of(recurring,extra)));
        assertThat(BaitlySubscriptionBilling.paidPeriodEnd(invoice)).isEqualTo(java.time.Instant.ofEpochSecond(1802592000));
        recurring.getParent().getSubscriptionItemDetails().setProration(true);
        assertThatThrownBy(()->BaitlySubscriptionBilling.paidPeriodEnd(invoice)).hasMessageContaining("Période");
    }
    @Test void existingEighthMonthKeepsRemainingFiveMonthsBeforePermanentDiscount() {
        var order=order();order.setSubscriptionMonth(8);
        var phases=(List<Map<String,Object>>)BaitlySubscriptionSchedule.parameters(order,"prod",1000).get("phases");
        assertThat(phases.stream().map(p->(Integer)((Map<?,?>)p.get("duration")).get("interval_count"))).containsExactly(5,1);
    }
}
