package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.payment.StripeGateway;
import com.stripe.model.*;
import org.junit.jupiter.api.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlySignupCheckoutTest {
    StripeGateway stripe;BaitlySubscriptionOrderRepository orders;PendingInscriptionRepository signups;
    PlatformPromoCodeRepository promos;BaitlySubscriptionSchedule schedules;BaitlySignupCheckout service;
    BaitlySubscriptionOrder order;PendingInscription pending;PlatformPromoCode promo;
    com.stripe.model.checkout.Session session;Subscription subscription;
    @BeforeEach void setup()throws Exception {
        stripe=mock(StripeGateway.class);orders=mock(BaitlySubscriptionOrderRepository.class);signups=mock(PendingInscriptionRepository.class);
        promos=mock(PlatformPromoCodeRepository.class);schedules=mock(BaitlySubscriptionSchedule.class);
        var tx=mock(PlatformTransactionManager.class);when(tx.getTransaction(any())).thenAnswer(call->new SimpleTransactionStatus());
        service=new BaitlySignupCheckout(signups,orders,promos,mock(UserRepository.class),new BaitlyMonthlyPricing(),stripe,schedules,new com.fasterxml.jackson.databind.ObjectMapper(),tx);
        order=BaitlyMonthlySubscriptionTest.order();order.setOrganizationId(null);order.setSignupId(7L);order.setMarket("EU");order.setStatus("CHECKOUT_OPEN");order.setPromoCodeId(9L);order.setPromoCode("PROMO");
        pending=new PendingInscription();pending.setId(7L);pending.setBillingCountry("FR");
        promo=new PlatformPromoCode();promo.setCode("PROMO");
        when(orders.findByCheckoutSessionId("cs_test")).thenReturn(Optional.of(order));when(orders.lockById(5L)).thenReturn(Optional.of(order));
        when(signups.lockById(7L)).thenReturn(Optional.of(pending));when(promos.lockByCode("PROMO")).thenReturn(Optional.of(promo));
        session=BaitlyMonthlySubscriptionTest.paid();session.setMetadata(Map.of("type","inscription","baitly_order_id","5","signupId","7","priceVersion",BaitlyMonthlyPricing.VERSION));
        var address=new Address();address.setCountry("FR");var customer=new com.stripe.model.checkout.Session.CustomerDetails();customer.setAddress(address);session.setCustomerDetails(customer);
        when(stripe.retrieveSession("cs_test")).thenReturn(session);
        subscription=new Subscription();subscription.setId("sub_test");subscription.setCustomer("cus_test");subscription.setStatus("active");subscription.setLatestInvoice("in_test");
        when(stripe.retrieveSubscription("sub_test")).thenReturn(subscription);when(schedules.install(order,subscription)).thenReturn("schedule_test");
        var invoice=BaitlyMonthlySubscriptionTest.invoice();invoice.getLines().getData().getFirst().getPeriod().setEnd(Instant.now().plusSeconds(86400*30L).getEpochSecond());when(stripe.retrieveInvoice("in_test")).thenReturn(invoice);
    }
    @Test void canonicalPaidProofInstallsLoyaltyAndConsumesPromoOnlyOnce()throws Exception {
        assertThat(service.confirm("cs_test")).isTrue();service.confirm("cs_test");
        assertThat(order.getStatus()).isEqualTo("PAID_AWAITING_ACCOUNT");assertThat(promo.getUsedCount()).isEqualTo(1);
        assertThat(order.getStripeScheduleId()).isEqualTo("schedule_test");assertThat(pending.getStripeSubscriptionId()).isEqualTo("sub_test");
        assertThat(order.getPaidUntil()).isAfter(Instant.now());
    }
    @Test void forgedAmountDoesNotActivateOrConsumePromo() {
        session.setAmountTotal(1L);assertThatThrownBy(()->service.confirm("cs_test")).hasMessageContaining("preuve");
        verifyNoInteractions(schedules);verify(promos,never()).save(any());assertThat(order.getStatus()).isEqualTo("CHECKOUT_OPEN");
    }
    @Test void unpaidCheckoutCannotSendEmailOrProvisionAccount() {
        session.setPaymentStatus("unpaid");assertThatThrownBy(()->service.confirm("cs_test")).hasMessageContaining("preuve");verify(signups,never()).save(any());
    }
    @Test void cheaperMarketCannotBeUsedForAnotherBillingCountry() {
        session.getCustomerDetails().getAddress().setCountry("MA");assertThatThrownBy(()->service.confirm("cs_test")).hasMessageContaining("pays");verifyNoInteractions(schedules);
    }
    @Test void anotherSignupCannotReuseThePayment() {
        session.setMetadata(Map.of("type","inscription","signupId","8","baitly_order_id","5","priceVersion",BaitlyMonthlyPricing.VERSION));
        assertThatThrownBy(()->service.confirm("cs_test")).hasMessageContaining("preuve");
    }
    @Test void signedWebhookRecoversASessionWhoseCreateResponseWasLost()throws Exception {
        order.setCheckoutSessionId(null);order.setStatus("PREPARED");
        when(orders.findByCheckoutSessionId("cs_test")).thenReturn(Optional.empty());when(orders.findById(5L)).thenReturn(Optional.of(order));
        service.confirm("cs_test");assertThat(order.getCheckoutSessionId()).isEqualTo("cs_test");
        assertThat(pending.getStripeSessionId()).isEqualTo("cs_test");assertThat(promo.getUsedCount()).isEqualTo(1);
    }
    @Test void linkedContractDoesNotRestartSignupWhenAnOldWebhookIsReplayed()throws Exception {
        order.setOrganizationId(3L);order.setStatus("ACTIVE");subscription.setStatus("canceled");
        assertThat(service.confirm("cs_test")).isTrue();verify(stripe,never()).retrieveSubscription(anyString());verify(signups,never()).save(any());
    }
    @Test void bindRequiresPaidContractAndKeepsTheExactSubscription()throws Exception {
        when(orders.findBySignupId(7L)).thenReturn(Optional.of(order));var user=new User();user.setId(2L);var org=new Organization();org.setId(3L);
        assertThatThrownBy(()->service.bind(pending,user,org)).hasMessageContaining("rapprocher");
        service.confirm("cs_test");service.bind(pending,user,org);
        assertThat(order.getOrganizationId()).isEqualTo(3L);assertThat(order.getPayerUserId()).isEqualTo(2L);assertThat(order.getStatus()).isEqualTo("ACTIVE");
        assertThatThrownBy(()->service.bind(pending,user,new Organization())).hasMessageContaining("rapprocher");
    }
    @Test void anExpiredPaidPeriodCannotProvisionANewAccount()throws Exception {
        when(orders.findBySignupId(7L)).thenReturn(Optional.of(order));service.confirm("cs_test");order.setPaidUntil(Instant.now().minusSeconds(1));
        assertThatThrownBy(()->service.bind(pending,new User(),new Organization())).hasMessageContaining("rapprocher");
    }
}
