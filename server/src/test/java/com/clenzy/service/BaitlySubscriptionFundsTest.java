package com.clenzy.service;

import com.clenzy.payment.StripeGateway;
import com.stripe.model.*;
import org.junit.jupiter.api.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlySubscriptionFundsTest {
    StripeGateway stripe;BaitlySubscriptionFunds funds;Invoice invoice;Charge charge;
    @BeforeEach void setup()throws Exception {
        stripe=mock(StripeGateway.class);funds=new BaitlySubscriptionFunds(stripe,null,null,null);
        invoice=com.stripe.net.ApiResource.GSON.fromJson("{\"id\":\"in_1\",\"customer\":\"cus_1\",\"amount_paid\":1200,\"currency\":\"eur\"}",Invoice.class);
        var payment=com.stripe.net.ApiResource.GSON.fromJson("{\"id\":\"inpay_1\",\"invoice\":\"in_1\",\"status\":\"paid\",\"amount_paid\":1200,\"currency\":\"eur\",\"payment\":{\"type\":\"payment_intent\",\"payment_intent\":\"pi_1\"}}",InvoicePayment.class);
        var intent=com.stripe.net.ApiResource.GSON.fromJson("{\"id\":\"pi_1\",\"customer\":\"cus_1\",\"status\":\"succeeded\",\"latest_charge\":\"ch_1\"}",PaymentIntent.class);
        charge=com.stripe.net.ApiResource.GSON.fromJson("{\"object\":\"charge\",\"id\":\"ch_1\",\"payment_intent\":\"pi_1\",\"customer\":\"cus_1\",\"amount\":1200,\"amount_captured\":1200,\"amount_refunded\":0,\"paid\":true,\"captured\":true,\"currency\":\"eur\"}",Charge.class);
        when(stripe.invoicePayments("in_1",null)).thenReturn(List.of(payment));when(stripe.retrievePaymentIntent("pi_1")).thenReturn(intent);when(stripe.retrieveCharge("ch_1")).thenReturn(charge);
    }
    Refund refund(String id,String status,long amount){return com.stripe.net.ApiResource.GSON.fromJson("{\"object\":\"refund\",\"id\":\""+id+"\",\"charge\":\"ch_1\",\"amount\":"+amount+",\"currency\":\"eur\",\"status\":\""+status+"\"}",Refund.class);}
    @Test void pendingRefundFreezesRightsAndFailedRefundDoesNot()throws Exception {
        when(stripe.refundsForCharge("ch_1")).thenReturn(List.of(refund("re_1","succeeded",300),refund("re_2","pending",200),refund("re_3","failed",700)));
        charge.setAmountRefunded(300L);assertThat(funds.inspect(invoice)).extracting("paid","refunded","held","disputed").containsExactly(1200L,300L,500L,false);
    }
    @Test void wonDisputeRequiresActualRestitutionOfWithdrawnFunds()throws Exception {
        var dispute=com.stripe.net.ApiResource.GSON.fromJson("{\"object\":\"dispute\",\"id\":\"dp_1\",\"charge\":\"ch_1\",\"currency\":\"eur\",\"status\":\"won\",\"balance_transactions\":[{\"amount\":-1200,\"currency\":\"eur\"}]}",Dispute.class);
        when(stripe.disputesForCharge("ch_1")).thenReturn(List.of(dispute));
        assertThat(funds.inspect(invoice).disputed()).isTrue();
        var restoration=new BalanceTransaction();restoration.setAmount(1200L);restoration.setCurrency("eur");dispute.getBalanceTransactions().add(restoration);
        assertThat(funds.inspect(invoice).disputed()).isFalse();
    }
    @Test void partialChargeAllocationOrIncompleteRefundListCannotRestoreRights()throws Exception {
        charge.setAmount(2400L);assertThatThrownBy(()->funds.inspect(invoice)).hasMessageContaining("Charge");
        charge.setAmount(1200L);charge.setAmountRefunded(100L);assertThatThrownBy(()->funds.inspect(invoice)).hasMessageContaining("incomplet");
    }
    @Test void customerMismatchAndMissingInvoicePaymentsAreRejected()throws Exception {
        charge.setCustomer("cus_other");assertThatThrownBy(()->funds.inspect(invoice)).hasMessageContaining("Charge");
        when(stripe.invoicePayments("in_1",null)).thenReturn(List.of());assertThatThrownBy(()->funds.inspect(invoice)).hasMessageContaining("incomplète");
    }
}
