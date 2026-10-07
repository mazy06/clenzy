package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.payment.StripeGateway;
import com.clenzy.service.ai.AiCreditGrantService;
import com.stripe.model.*;
import com.stripe.model.Invoice;
import org.junit.jupiter.api.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlySubscriptionBillingTest {
    StripeGateway stripe;BaitlySubscriptionOrderRepository orders;BaitlySubscriptionInvoiceRepository invoices;
    OrganizationRepository organizations;OrganizationMemberRepository members;UserRepository users;
    BaitlyMonthlySubscriptionService monthly;AiCreditGrantService credits;BaitlySubscriptionBilling billing;
    BaitlySubscriptionFunds funds;
    BaitlySubscriptionOrder order;Organization org;Subscription subscription;Invoice invoice;
    @BeforeEach void setup()throws Exception {
        stripe=mock(StripeGateway.class);orders=mock(BaitlySubscriptionOrderRepository.class);invoices=mock(BaitlySubscriptionInvoiceRepository.class);
        organizations=mock(OrganizationRepository.class);members=mock(OrganizationMemberRepository.class);users=mock(UserRepository.class);
        monthly=mock(BaitlyMonthlySubscriptionService.class);credits=mock(AiCreditGrantService.class);
        var tx=mock(PlatformTransactionManager.class);when(tx.getTransaction(any())).thenAnswer(call->new SimpleTransactionStatus());
        funds=mock(BaitlySubscriptionFunds.class);
        when(funds.inspect(any())).thenAnswer(call->{Invoice i=call.getArgument(0);return new BaitlySubscriptionFunds.Snapshot(i.getAmountPaid(),0,0,false);});
        when(funds.paidUntil(any(),any())).thenAnswer(call->order.getPaidUntil());
        billing=new BaitlySubscriptionBilling(stripe,orders,invoices,organizations,monthly,credits,members,users,tx,mock(BaitlySubscriptionAmendments.class),funds);
        order=BaitlyMonthlySubscriptionTest.order();order.setStatus("ACTIVE");order.setPaidUntil(Instant.now().plusSeconds(86400));
        org=new Organization();org.setId(2L);org.setStripeSubscriptionId("sub_test");org.setForfait("essentiel");
        subscription=new Subscription();subscription.setId("sub_test");subscription.setCustomer("cus_test");subscription.setStatus("active");
        invoice=BaitlyMonthlySubscriptionTest.invoice();invoice.getLines().getData().getFirst().getPeriod().setEnd(Instant.now().plusSeconds(30L*86400).getEpochSecond());
        when(stripe.retrieveInvoice("in_test")).thenReturn(invoice);when(stripe.retrieveSubscription("sub_test")).thenReturn(subscription);
        when(orders.findByStripeSubscriptionId("sub_test")).thenReturn(Optional.of(order));when(orders.findById(5L)).thenReturn(Optional.of(order));
        when(orders.lockByIdAndOrganizationId(5L,2L)).thenReturn(Optional.of(order));when(organizations.lockById(2L)).thenReturn(Optional.of(org));
    }
    @Test void refreshUsesCanonicalStatusAndKeepsLaterPaidPeriod()throws Exception {
        Instant later=Instant.now().plusSeconds(60L*86400);order.setPaidUntil(later);order.setStatus("PAST_DUE");
        assertThat(billing.invoice("in_test")).isTrue();
        assertThat(order.getPaidUntil()).isEqualTo(later);assertThat(order.getStatus()).isEqualTo("ACTIVE");
        verify(credits).grantForVerifiedInvoice(eq(2L),eq("essentiel"),eq("in_test"),any());
    }
    @Test void lateInvoiceForReplacedSubscriptionNeverRestoresAccessOrGrantsCredits()throws Exception {
        org.setStripeSubscriptionId("sub_new");org.setForfait("premium");billing.invoice("in_test");
        assertThat(order.getStatus()).isEqualTo("REPLACED");assertThat(org.getForfait()).isEqualTo("premium");verifyNoInteractions(credits);
        verify(invoices).save(any());
    }
    @Test void renewalFailureDoesNotRemoveTheRemainderOfAnAlreadyPaidPeriod()throws Exception {
        subscription.setStatus("past_due");invoice.setStatus("open");invoice.setAmountPaid(0L);invoice.setAmountRemaining(3480L);
        billing.invoice("in_test");assertThat(order.getStatus()).isEqualTo("PAST_DUE");assertThat(org.getForfait()).isEqualTo("essentiel");verifyNoInteractions(credits);
    }
    @Test void expirationAlsoRevokesLegacyPrimaryMembershipAccess() {
        order.setPaidUntil(Instant.now().minusSeconds(1));order.setStatus("CANCELLED");
        var primary=new User();primary.setOrganizationId(2L);primary.setForfait("essentiel");
        var other=new User();other.setOrganizationId(3L);other.setForfait("premium");
        var primaryMember=new OrganizationMember();primaryMember.setUser(primary);var otherMember=new OrganizationMember();otherMember.setUser(other);
        when(members.findByOrganizationIdWithUser(2L)).thenReturn(List.of(primaryMember,otherMember));
        billing.expirePaidAccess(5L,2L);
        assertThat(org.getForfait()).isEqualTo("inactive");assertThat(primary.getForfait()).isEqualTo("inactive");assertThat(other.getForfait()).isEqualTo("premium");
        assertThat(order.getStatus()).isEqualTo("ENDED");verifyNoInteractions(stripe);
    }
    @Test void paidInvoiceCanArriveBeforeCheckoutWebhook()throws Exception {
        order.setStatus("CHECKOUT_OPEN");doAnswer(call->{order.setStatus("ACTIVE");return null;}).when(monthly).complete("cs_test");
        billing.invoice("in_test");verify(monthly).complete("cs_test");verify(credits).grantForVerifiedInvoice(eq(2L),anyString(),eq("in_test"),any());
    }
    @Test void unpaidFirstInvoiceCannotActivatePendingOrder()throws Exception {
        order.setStatus("CHECKOUT_OPEN");invoice.setStatus("open");billing.invoice("in_test");
        verifyNoInteractions(monthly,credits,invoices);assertThat(order.getStatus()).isEqualTo("CHECKOUT_OPEN");
    }
    @Test void foreignCustomerCannotCreateReceiptOrGrant() {
        invoice.setCustomer("cus_other");assertThatThrownBy(()->billing.invoice("in_test")).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(invoices,credits);
    }
}
