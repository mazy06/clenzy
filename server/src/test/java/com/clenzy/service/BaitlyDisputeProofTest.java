package com.clenzy.service;

import com.clenzy.model.*;
import com.stripe.model.*;
import com.stripe.model.checkout.Session;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.math.BigDecimal;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

class BaitlyDisputeProofTest {
    PaymentTransaction payment; Session session; Charge charge; Dispute dispute;
    @BeforeEach void seed() {
        payment=new PaymentTransaction(); payment.setId(1L); payment.setOrganizationId(7L); payment.setTransactionRef("TX-test");
        payment.setProviderType(PaymentProviderType.STRIPE); payment.setProviderTxId("cs_test");
        payment.setPaymentType(TransactionType.CHECKOUT); payment.setStatus(TransactionStatus.COMPLETED);
        payment.setAmount(new BigDecimal("35")); payment.setCurrency("EUR");
        session=new Session(); session.setId("cs_test"); session.setPaymentIntent("pi_test"); session.setLivemode(false);
        session.setMode("payment"); session.setStatus("complete"); session.setPaymentStatus("paid"); session.setAmountTotal(3500L);
        session.setCurrency("eur"); session.setMetadata(Map.of("transactionRef","TX-test","organizationId","999"));
        charge=new Charge(); charge.setId("ch_test"); charge.setPaymentIntent("pi_test"); charge.setLivemode(false);
        charge.setAmount(3500L); charge.setCurrency("eur"); charge.setPaid(true);
        dispute=new Dispute(); dispute.setId("dp_test"); dispute.setCharge("ch_test"); dispute.setPaymentIntent("pi_test");
        dispute.setLivemode(false); dispute.setAmount(3500L); dispute.setCurrency("eur"); dispute.setStatus("needs_response");
    }
    @Test void resolvesChargeThroughSessionAndUsesOnlyLocalOrganization() {
        var proof=BaitlyDisputeProof.checked(payment,session,charge,dispute);
        assertThat(proof.paymentId()).isEqualTo(1L); assertThat(proof.org()).isEqualTo(7L);
        assertThat(proof.amount()).isEqualByComparingTo("35"); assertThat(proof.released()).isFalse();
    }
    @ParameterizedTest @ValueSource(strings={"session","intent","charge","amount","currency","mode","status","reference","live","unpaid"})
    void incompatibleProofNeverIdentifiesFunds(String fault) {
        switch(fault) {
            case "session" -> session.setId("cs_other");
            case "intent" -> charge.setPaymentIntent("pi_other");
            case "charge" -> dispute.setCharge("ch_other");
            case "amount" -> dispute.setAmount(3600L);
            case "currency" -> dispute.setCurrency("usd");
            case "mode" -> session.setMode("setup");
            case "status" -> dispute.setStatus("unknown");
            case "reference" -> session.setMetadata(Map.of("transactionRef","TX-other"));
            case "live" -> dispute.setLivemode(true);
            case "unpaid" -> payment.setStatus(TransactionStatus.PROCESSING);
        }
        assertThatThrownBy(()->BaitlyDisputeProof.checked(payment,session,charge,dispute)).isInstanceOf(IllegalStateException.class);
    }
    @Test void preservesActualFeeAndNetRatherThanInventingAFee() {
        var movement=new BalanceTransaction(); movement.setId("txn_debit"); movement.setAmount(-3500L); movement.setFee(1500L);
        movement.setNet(-5000L); movement.setCurrency("eur"); movement.setCreated(1700000000L); movement.setAvailableOn(1700000000L);
        dispute.setBalanceTransactions(List.of(movement));
        var proof=BaitlyDisputeProof.checked(payment,session,charge,dispute);
        assertThat(proof.movements().getFirst().net()).isEqualByComparingTo("-50");
        movement.setNet(-4900L);
        assertThatThrownBy(()->BaitlyDisputeProof.checked(payment,session,charge,dispute)).hasMessageContaining("solde Stripe");
    }
}
