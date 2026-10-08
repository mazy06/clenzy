package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.PaymentTransactionRepository;
import com.stripe.model.checkout.Session;
import org.junit.jupiter.api.*;
import java.math.BigDecimal;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyCheckoutJournalTest {
    final PaymentTransactionRepository payments=mock(PaymentTransactionRepository.class);
    final PaymentPersistence persistence=mock(PaymentPersistence.class);
    final BaitlyCheckoutJournal journal=new BaitlyCheckoutJournal(payments,persistence);
    PaymentTransaction tx; Session session;
    @BeforeEach void setup() {
        tx=new PaymentTransaction();tx.setTransactionRef("TX-topup");tx.setOrganizationId(2L);tx.setSourceType("AI_CREDIT_TOPUP");tx.setSourceId(2L);
        tx.setProviderType(PaymentProviderType.STRIPE);tx.setPaymentType(TransactionType.CHECKOUT);tx.setProviderTxId("cs_topup");
        tx.setAmount(new BigDecimal("12"));tx.setCurrency("EUR");tx.setStatus(TransactionStatus.PROCESSING);
        session=new Session();session.setId("cs_topup");session.setMode("payment");session.setStatus("complete");session.setPaymentStatus("paid");
        session.setPaymentIntent("pi_topup");session.setAmountTotal(1200L);session.setCurrency("eur");
        session.setMetadata(new HashMap<>(Map.of("transactionRef","TX-topup","sourceType","AI_CREDIT_TOPUP","sourceId","2","orgId","2")));
        when(payments.findByProviderTxId("cs_topup")).thenReturn(Optional.of(tx));when(payments.lockByReference(2L,"TX-topup")).thenReturn(Optional.of(tx));
    }
    @Test void confirmsMatchingReceiptThroughAtomicPersistence() { journal.apply(session,true);verify(persistence).completeTransaction("TX-topup"); }
    @Test void rejectsOtherAmount() { session.setAmountTotal(1199L);reject(); }
    @Test void rejectsOtherCurrency() { session.setCurrency("SAR");reject(); }
    @Test void rejectsOtherTenant() { session.getMetadata().put("orgId","9");reject(); }
    @Test void rejectsOtherSource() { session.getMetadata().put("sourceType","UPSELL");reject(); }
    @Test void rejectsOtherReference() { session.getMetadata().put("transactionRef","TX-victim");reject(); }
    @Test void rejectsUnpaid() { session.setPaymentStatus("unpaid");reject(); }
    @Test void rejectsOpenSession() { session.setStatus("open");reject(); }
    @Test void rejectsRefundAsCheckout() { tx.setPaymentType(TransactionType.REFUND);reject(); }
    @Test void rejectsUnfundedFreeClaimForPositiveDebt() { session.setPaymentStatus("no_payment_required");session.setPaymentIntent(null);reject(); }
    @Test void supportsActuallyFreeCheckout() {
        tx.setAmount(BigDecimal.ZERO);session.setAmountTotal(0L);session.setPaymentStatus("no_payment_required");session.setPaymentIntent(null);
        journal.apply(session,true);verify(persistence).completeTransaction("TX-topup");
    }
    @Test void cannotDowngradePaidProof() { assertThatThrownBy(()->journal.apply(session,false)).isInstanceOf(IllegalStateException.class);verifyNoInteractions(persistence); }
    private void reject() { assertThatThrownBy(()->journal.apply(session,true)).isInstanceOf(IllegalStateException.class);verifyNoInteractions(persistence); }
}
