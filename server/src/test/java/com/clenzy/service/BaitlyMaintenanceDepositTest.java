package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.payment.StripeGateway;
import com.clenzy.tenant.TenantScopedExecutor;
import com.stripe.model.checkout.Session;
import org.junit.jupiter.api.*;
import java.math.BigDecimal;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyMaintenanceDepositTest {
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings={"INTERVENTION","INTERVENTION_BATCH","DEFERRED_HOST","DEFERRED_PROPERTY"})
    void depositBalanceUsesDedicatedCheckoutEvenWhenPreparedFromABatch(String source) {
        var em=mock(jakarta.persistence.EntityManager.class);var payments=mock(PaymentTransactionRepository.class);var quotes=mock(ServiceQuoteRepository.class);
        var mission=new Intervention();mission.setId(10L);mission.setOrganizationId(2L);mission.setEstimatedCost(new BigDecimal("200"));mission.setCurrency("EUR");
        var agreement=quote();agreement.setDepositTransactionRef("DEP-1");agreement.setDepositPaidAt(java.time.LocalDateTime.now());
        when(em.find(Intervention.class,10L)).thenReturn(mission);
        when(quotes.findByInterventionIdAndOrganizationIdOrderByAmountAsc(10L,2L)).thenReturn(List.of(agreement));
        when(payments.findByOrganizationIdAndSourceTypeAndSourceId(2L,"INTERVENTION",10L)).thenReturn(List.of(payment()));
        String kind=switch(source){case "DEFERRED_HOST"->DeferredPaymentService.SOURCE_TYPE_HOST;case "DEFERRED_PROPERTY"->DeferredPaymentService.SOURCE_TYPE_PROPERTY;default->source;};
        Map<String,String> meta=source.startsWith("DEFERRED")?Map.of("intervention_ids","10"):source.equals("INTERVENTION_BATCH")?Map.of("interventionIds","10"):Map.of();
        var request=new com.clenzy.dto.PaymentOrchestrationRequest(new BigDecimal("160"),"EUR",kind,10L,"Solde","test@example.test",null,null,null,meta,"balance-test");
        var service=new InterventionPaymentCoordination(em,payments,quotes,mock(CurrencyConverterService.class));
        if(source.equals("INTERVENTION"))assertThat(service.lockPaymentMissions(2L,request).get(10L)).isEqualByComparingTo("160.00");
        else assertThatThrownBy(()->service.lockPaymentMissions(2L,request)).hasMessageContaining("propre session");
    }
    @Test void historicalDateAndAmbiguousQuotesNeverProduceANewCharge() {
        var mission=new Intervention();mission.setEstimatedCost(new BigDecimal("200"));var quote=quote();
        quote.setDepositPaidAt(java.time.LocalDateTime.now());
        assertThat(InterventionPaymentAmounts.payable(mission,List.of(quote),false)).isNull();
        assertThat(InterventionPaymentAmounts.payable(mission,List.of(quote),true)).isNull();
        quote.setDepositTransactionRef("DEP-1");
        assertThat(InterventionPaymentAmounts.payable(mission,List.of(quote,quote()),false)).isNull();
    }
    @Test void balanceRequiresTheExactDepositReceiptWithoutDisputeOrRefund() {
        var mission=new Intervention();mission.setId(10L);mission.setOrganizationId(2L);mission.setCurrency("EUR");
        mission.setEstimatedCost(new BigDecimal("200"));var quote=quote();quote.setDepositTransactionRef("DEP-1");
        quote.setDepositPaidAt(java.time.LocalDateTime.now());var receipt=payment();
        DepositReconciler.requireAvailableDeposit(mission,List.of(quote),List.of(receipt));
        receipt.setDisputedAmount(BigDecimal.ONE);
        assertThatThrownBy(()->DepositReconciler.requireAvailableDeposit(mission,List.of(quote),List.of(receipt))).hasMessageContaining("contesté");
        receipt.setDisputedAmount(BigDecimal.ZERO);
        var refund=new PaymentTransaction();refund.setPaymentType(TransactionType.REFUND);refund.setStatus(TransactionStatus.PROCESSING);
        assertThatThrownBy(()->DepositReconciler.requireAvailableDeposit(mission,List.of(quote),List.of(receipt,refund))).hasMessageContaining("remboursé");
        assertThatThrownBy(()->DepositReconciler.requireAvailableDeposit(mission,List.of(quote),List.of())).hasMessageContaining("rapproché");
        receipt.setAmount(new BigDecimal("20"));
        assertThatThrownBy(()->DepositReconciler.requireAvailableDeposit(mission,List.of(quote),List.of(receipt))).hasMessageContaining("ne correspond pas");
    }
    static PaymentTransaction payment() {
        var tx=new PaymentTransaction();tx.setOrganizationId(2L);tx.setSourceType("INTERVENTION");tx.setSourceId(10L);
        tx.setTransactionRef("DEP-1");tx.setProviderTxId("cs_deposit");tx.setProviderType(PaymentProviderType.STRIPE);
        tx.setPaymentType(TransactionType.CHECKOUT);tx.setStatus(TransactionStatus.COMPLETED);tx.setAmount(new BigDecimal("40.00"));
        tx.setCurrency("EUR");tx.setMetadata(Map.of("purpose","DEPOSIT"));return tx;
    }
    static ServiceQuote quote() {
        var quote=new ServiceQuote();quote.setId(5L);quote.setOrganizationId(2L);quote.setInterventionId(10L);
        quote.setStatus(ServiceQuote.Status.APPROVED);quote.setCurrency("EUR");quote.setAmount(new BigDecimal("200"));quote.setDepositAmount(new BigDecimal("40"));return quote;
    }
    static Session session() {
        return com.stripe.net.ApiResource.GSON.fromJson("""
          {"id":"cs_deposit","mode":"payment","status":"complete","payment_status":"paid","payment_intent":"pi_test",
          "amount_total":4000,"currency":"eur","metadata":{"transactionRef":"DEP-1","orgId":"2","sourceId":"10","sourceType":"INTERVENTION","purpose":"DEPOSIT"}}
          """,Session.class);
    }
    @Test void depositIsMatchedOnceAndOnlyItsNetAmountReducesBalance() {
        var repo=mock(ServiceQuoteRepository.class);var quote=quote();when(repo.findByInterventionIdAndOrganizationIdOrderByAmountAsc(10L,2L)).thenReturn(List.of(quote));
        when(repo.lockByIdAndOrganizationId(5L,2L)).thenReturn(Optional.of(quote));var reconciler=new DepositReconciler(repo);
        reconciler.onPaymentCompleted(payment());var time=quote.getDepositPaidAt();reconciler.onPaymentCompleted(payment());
        assertThat(quote.getDepositPaidAt()).isEqualTo(time);assertThat(quote.getDepositTransactionRef()).isEqualTo("DEP-1");
        var mission=new Intervention();mission.setEstimatedCost(new BigDecimal("200"));
        assertThat(InterventionPaymentAmounts.payable(mission,List.of(quote),false)).isEqualByComparingTo("160");
        assertThat(InterventionPaymentAmounts.payable(mission,List.of(quote),true)).isNull();
    }
    @Test void wrongAmountCurrencyAndDuplicateReceiptsCannotMarkAQuotePaid() {
        var tx=payment();var quote=quote();
        tx.setAmount(new BigDecimal("20"));assertThatThrownBy(()->DepositReconciler.validate(tx,quote)).isInstanceOf(IllegalStateException.class);
        tx.setAmount(new BigDecimal("40"));tx.setCurrency("MAD");assertThatThrownBy(()->DepositReconciler.validate(tx,quote)).isInstanceOf(IllegalStateException.class);
        tx.setCurrency("EUR");quote.setDepositTransactionRef("DEP-OTHER");assertThatThrownBy(()->DepositReconciler.validate(tx,quote)).isInstanceOf(IllegalStateException.class);
        assertThat(quote.getDepositPaidAt()).isNull();
    }
    @Test void aForgedPurposeOrAnotherOrganizationCannotReuseTheSameSession() {
        var incoming=session();BaitlyMaintenanceDepositCheckout.verify(payment(),incoming);
        incoming.getMetadata().put("purpose","FULL");assertThatThrownBy(()->BaitlyMaintenanceDepositCheckout.verify(payment(),incoming)).isInstanceOf(IllegalStateException.class);
        incoming.getMetadata().put("purpose","DEPOSIT");incoming.getMetadata().put("orgId","3");
        assertThatThrownBy(()->BaitlyMaintenanceDepositCheckout.verify(payment(),incoming)).isInstanceOf(IllegalStateException.class);
    }
    @Test void checkoutRefreshUsesCanonicalStateAndCannotExposeAnotherTenant()throws Exception {
        var payments=mock(PaymentTransactionRepository.class);var stripe=mock(StripeGateway.class);var writer=mock(BaitlyMaintenanceDepositWriter.class);
        var tenants=mock(TenantScopedExecutor.class);when(tenants.callAsOrganization(eq(2L),any())).thenAnswer(call->((java.util.function.Supplier<?>)call.getArgument(1)).get());
        when(payments.findByProviderTxId("cs_deposit")).thenReturn(Optional.of(payment()));when(stripe.retrieveSession("cs_deposit")).thenReturn(session());
        var service=new BaitlyMaintenanceDepositCheckout(payments,stripe,writer,tenants);
        assertThat(service.sessionStatus("cs_deposit",3L)).isEmpty();verifyNoInteractions(stripe,writer);
        assertThat(service.sessionStatus("cs_deposit",2L).orElseThrow()).containsEntry("paymentStatus","PAID").containsEntry("interventionStatus","DEPOSIT_PAID");
        verify(writer).confirm("DEP-1","cs_deposit");
    }
    @Test void partialDepositNeverConfirmsTheWholeMissionAndFullDepositDoes() {
        var payments=mock(PaymentTransactionRepository.class);var coordination=mock(InterventionPaymentCoordination.class);
        var missions=mock(InterventionRepository.class);var persistence=mock(PaymentPersistence.class);var confirmation=mock(StripePaymentConfirmationService.class);
        var tx=payment();var mission=new Intervention();mission.setEstimatedCost(new BigDecimal("200"));
        when(payments.findByTransactionRef("DEP-1")).thenReturn(Optional.of(tx));when(payments.lockByReference(2L,"DEP-1")).thenReturn(Optional.of(tx));
        when(coordination.lockMission(2L,10L)).thenReturn(mission);
        var writer=new BaitlyMaintenanceDepositWriter(payments,coordination,missions,persistence,confirmation);
        writer.confirm("DEP-1","cs_deposit");verifyNoInteractions(confirmation);assertThat(mission.getStripeSessionId()).isNull();
        mission.setEstimatedCost(new BigDecimal("40"));writer.confirm("DEP-1","cs_deposit");verify(confirmation).confirmPayment("cs_deposit");
    }
    @Test void expiredDepositReleasesOnlyItsAttemptAndCannotDowngradeAReceipt() {
        var payments=mock(PaymentTransactionRepository.class);var tx=payment();
        when(payments.findByTransactionRef("DEP-1")).thenReturn(Optional.of(tx));when(payments.lockByReference(2L,"DEP-1")).thenReturn(Optional.of(tx));
        var coordination=mock(InterventionPaymentCoordination.class);var missions=mock(InterventionRepository.class);
        var writer=new BaitlyMaintenanceDepositWriter(payments,coordination,missions,mock(PaymentPersistence.class),mock(StripePaymentConfirmationService.class));
        assertThatThrownBy(()->writer.expire("DEP-1","cs_deposit")).hasMessageContaining("encaissé");
        tx.setStatus(TransactionStatus.PROCESSING);writer.expire("DEP-1","cs_deposit");
        assertThat(tx.getMetadata()).containsEntry("standaloneRetryAllowed",true);assertThat(tx.getStatus()).isEqualTo(TransactionStatus.FAILED);verifyNoInteractions(missions,coordination);
    }
}
