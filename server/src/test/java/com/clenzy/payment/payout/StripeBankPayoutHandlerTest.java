package com.clenzy.payment.payout;

import com.clenzy.model.BankPayoutObservation;
import com.clenzy.payment.StripeGateway;
import com.clenzy.service.payout.BankPayoutStore;
import com.clenzy.tenant.TenantContext;
import com.stripe.exception.ApiConnectionException;
import com.stripe.model.*;
import com.stripe.net.ApiResource;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.time.Instant;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class StripeBankPayoutHandlerTest {
    private final StripeGateway stripe = mock(StripeGateway.class);
    private final BankPayoutStore store = mock(BankPayoutStore.class);
    private final TenantContext tenant = new TenantContext();
    private final StripeBankPayoutHandler handler = new StripeBankPayoutHandler(stripe,store,tenant);
    private Payout payout;

    @BeforeEach void setup() throws Exception {
        tenant.clear();
        when(store.needsProcessing("acct_provider","evt_bank")).thenReturn(true);
        payout = new Payout(); payout.setId("po_bank"); payout.setCreated(100L); payout.setLivemode(false);
        payout.setAutomatic(true); payout.setCurrency("eur"); payout.setStatus("paid");
        payout.setAmount(8000L);
        payout.setReconciliationStatus("completed"); payout.setArrivalDate(300L);
        when(stripe.retrieveConnectedPayout("acct_provider","po_bank")).thenReturn(payout);
    }
    @AfterEach void cleanup() { tenant.clear(); }

    private Event event() {
        // Version volontairement ancienne : les seuls champs stables sont relus par GET canonique.
        return ApiResource.GSON.fromJson("""
            {"id":"evt_bank","type":"payout.paid","account":"acct_provider","created":200,"livemode":false,
             "api_version":"2020-08-27","data":{"object":{"object":"payout","id":"po_bank"}}}
            """, Event.class);
    }
    private BalanceTransaction credit(String id,String source,long amount,String currency) {
        var row=new BalanceTransaction(); row.setId(id);row.setSource(source);row.setAmount(amount);row.setNet(amount);row.setCurrency(currency);return row;
    }
    private StripeCollection<BalanceTransaction> page(boolean more,BalanceTransaction...rows) {
        var page=new StripeCollection<BalanceTransaction>();page.setData(List.of(rows));page.setHasMore(more);return page;
    }

    @Test void readsEveryPageUnderConnectedAccountAndRetainsOnlyExactCredits() throws Exception {
        var fee=credit("txn_fee","py_fee",8000,"eur");fee.setNet(7900L);
        payout.setAmount(25400L);
        var ownDebit=credit("txn_4","po_bank",-25400,"eur");ownDebit.setType("payout");
        when(stripe.listConnectedPayoutTransactions("acct_provider","po_bank",null)).thenReturn(page(true,
                credit("txn_1","py_owner",8000,"eur"), fee));
        when(stripe.listConnectedPayoutTransactions("acct_provider","po_bank","txn_fee")).thenReturn(page(false,
                credit("txn_2","py_company",9500,"eur"),ownDebit));
        doAnswer(invocation -> { assertThat(tenant.isSystemOrg()).isTrue(); return null; })
                .when(store).append(any(),any(),any(),anyBoolean(),any(),any(),any(),any(),any(),any());

        handler.handleVerifiedEvent(event());

        verify(store).append(eq("evt_bank"),eq("acct_provider"),eq("po_bank"),eq(false),eq(BankPayoutObservation.Status.PAID),
                eq(Instant.ofEpochSecond(100)),eq(Instant.ofEpochSecond(200)),eq(Instant.ofEpochSecond(300)),isNull(),
                eq(List.of(new BankPayoutObservation.Source("py_owner",8000,"eur"),new BankPayoutObservation.Source("py_company",9500,"eur"))));
        assertThat(tenant.isSystemOrg()).isFalse();
        verify(stripe,never()).createTransfer(any(),any());
    }

    @Test void repeatedUnknownAndPlatformEventsDoNotCallStripe() throws Exception {
        var platform=event();platform.setAccount(null);handler.handleVerifiedEvent(platform);
        verifyNoInteractions(store,stripe);
        when(store.needsProcessing(any(),any())).thenReturn(false);
        handler.handleVerifiedEvent(event());verifyNoInteractions(stripe);
    }

    @Test void latePaidEventUsesCurrentFailedState() throws Exception {
        payout.setStatus("failed");payout.setFailureCode("account_closed");payout.setReconciliationStatus("not_applicable");
        handler.handleVerifiedEvent(event());
        verify(store).append(any(),any(),any(),eq(false),eq(BankPayoutObservation.Status.FAILED),any(),any(),any(),eq("account_closed"),eq(List.of()));
        verify(stripe,never()).listConnectedPayoutTransactions(any(),any(),any());
    }

    @ParameterizedTest @ValueSource(strings={"in_progress","not_applicable"})
    void incompleteReconciliationNeverPretendsToMatchTransfers(String reconciliation) throws Exception {
        payout.setReconciliationStatus(reconciliation);handler.handleVerifiedEvent(event());
        verify(stripe,never()).listConnectedPayoutTransactions(any(),any(),any());
        verify(store).append(any(),any(),any(),anyBoolean(),any(),any(),any(),any(),any(),eq(List.of()));
    }

    @Test void manualPayoutDoesNotUseAutomaticPayoutFilter() throws Exception {
        payout.setAutomatic(false);handler.handleVerifiedEvent(event());
        verify(stripe,never()).listConnectedPayoutTransactions(any(),any(),any());
    }

    @Test void refundDebitInLaterPageDoesNotCertifyOriginalGrossAsBankReceived() throws Exception {
        payout.setAmount(7000L);
        when(stripe.listConnectedPayoutTransactions("acct_provider","po_bank",null))
                .thenReturn(page(true,credit("txn_credit","py_owner",8000,"eur")));
        when(stripe.listConnectedPayoutTransactions("acct_provider","po_bank","txn_credit"))
                .thenReturn(page(false,credit("txn_refund","pyr_refund",-1000,"eur")));

        handler.handleVerifiedEvent(event());

        verify(store).append(any(),any(),any(),anyBoolean(),eq(BankPayoutObservation.Status.PAID),
                any(),any(),any(),any(),eq(List.of()));
    }

    @Test void creditsMustReconcileExactlyToCanonicalPayoutAmount() throws Exception {
        when(store.isKnownAccount("acct_provider",false)).thenReturn(true);
        payout.setAmount(7999L);
        when(stripe.listConnectedPayoutTransactions(any(),any(),any()))
                .thenReturn(page(false,credit("txn_credit","py_owner",8000,"eur")));

        handler.recover("acct_provider",false,"po_bank",Instant.now());

        verify(store).append(any(),any(),any(),anyBoolean(),any(),any(),any(),any(),any(),eq(List.of()));
    }

    @ParameterizedTest @ValueSource(strings={"refund","fee","other-payout","foreign-currency"})
    void unallocatedDebitOrConversionNeverCertifiesAnotherCredit(String kind) throws Exception {
        var other=switch(kind) {
            case "refund" -> credit("txn_other","pyr_other",-1000,"eur");
            case "fee" -> credit("txn_other",null,-1000,"eur");
            case "other-payout" -> credit("txn_other","po_other",-1000,"eur");
            default -> credit("txn_other","py_foreign",1000,"usd");
        };
        payout.setAmount(8000L+other.getNet());
        when(stripe.listConnectedPayoutTransactions(any(),any(),any()))
                .thenReturn(page(false,credit("txn_credit","py_owner",8000,"eur"),other));
        handler.handleVerifiedEvent(event());
        verify(store).append(any(),any(),any(),anyBoolean(),any(),any(),any(),any(),any(),eq(List.of()));
    }

    @ParameterizedTest @ValueSource(strings={"missing-amount","missing-net","missing-currency","duplicate-source","wrong-payout-debit","duplicate-payout-debit"})
    void invalidBankEvidenceIsNotRecorded(String defect) throws Exception {
        var credit=credit("txn_credit","py_owner",8000,"eur");
        var rows=new java.util.ArrayList<BalanceTransaction>();rows.add(credit);
        switch(defect) {
            case "missing-amount" -> credit.setAmount(null);
            case "missing-net" -> credit.setNet(null);
            case "missing-currency" -> credit.setCurrency(null);
            case "duplicate-source" -> rows.add(credit("txn_other","py_owner",8000,"eur"));
            case "wrong-payout-debit" -> rows.add(credit("txn_other","po_bank",-7999,"eur"));
            case "duplicate-payout-debit" -> {
                var debit=credit("txn_debit","po_bank",-8000,"eur");debit.setType("payout");rows.add(debit);
                var duplicate=credit("txn_duplicate","po_bank",-8000,"eur");duplicate.setType("payout");rows.add(duplicate);
            }
        }
        when(stripe.listConnectedPayoutTransactions(any(),any(),any()))
                .thenReturn(page(false,rows.toArray(BalanceTransaction[]::new)));
        assertThatThrownBy(() -> handler.handleVerifiedEvent(event())).isInstanceOf(IllegalStateException.class);
        verify(store,never()).append(any(),any(),any(),anyBoolean(),any(),any(),any(),any(),any(),any());
        assertThat(tenant.isSystemOrg()).isFalse();
    }

    @Test void failedPaginationIsNotMarkedProcessedAndRestoresTenantFlags() throws Exception {
        tenant.setOrganizationId(7L);
        when(stripe.listConnectedPayoutTransactions(any(),any(),isNull())).thenReturn(page(true,credit("txn_1","py_1",8000,"eur")));
        when(stripe.listConnectedPayoutTransactions(any(),any(),eq("txn_1"))).thenThrow(new ApiConnectionException("Unavailable"));
        assertThatThrownBy(() -> handler.handleVerifiedEvent(event())).isInstanceOf(ApiConnectionException.class);
        verify(store,never()).append(any(),any(),any(),anyBoolean(),any(),any(),any(),any(),any(),any());
        assertThat(tenant.isSystemOrg()).isFalse();assertThat(tenant.getOrganizationId()).isEqualTo(7L);
    }

    @Test void duplicatePageFailsClosed() throws Exception {
        when(stripe.listConnectedPayoutTransactions(any(),any(),any())).thenReturn(page(true,credit("txn_1","py_1",8000,"eur")));
        assertThatThrownBy(() -> handler.handleVerifiedEvent(event())).isInstanceOf(IllegalStateException.class);
        verify(store,never()).append(any(),any(),any(),anyBoolean(),any(),any(),any(),any(),any(),any());
    }

    @Test void liveTestMismatchNeverStoresBankProof() {
        payout.setLivemode(true);
        assertThatThrownBy(() -> handler.handleVerifiedEvent(event())).isInstanceOf(IllegalStateException.class);
        verify(store,never()).append(any(),any(),any(),anyBoolean(),any(),any(),any(),any(),any(),any());
    }

    @Test void refusesNetworkWithinTransaction() {
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try { assertThatThrownBy(() -> handler.handleVerifiedEvent(event())).isInstanceOf(IllegalStateException.class); }
        finally { TransactionSynchronizationManager.setActualTransactionActive(false); }
        verifyNoInteractions(store,stripe);
    }

    @Test void recoveryIsStableAcrossRepeatedReadsButChangesWithNewEvidence() throws Exception {
        when(store.isKnownAccount("acct_provider",false)).thenReturn(true);
        when(stripe.listConnectedPayoutTransactions(any(),any(),any())).thenReturn(page(false,credit("txn_1","py_owner",8000,"eur")));
        handler.recover("acct_provider",false,"po_bank",Instant.ofEpochSecond(400));
        handler.recover("acct_provider",false,"po_bank",Instant.ofEpochSecond(500));
        payout.setStatus("failed");payout.setFailureCode("account_closed");
        handler.recover("acct_provider",false,"po_bank",Instant.ofEpochSecond(600));
        var ids=ArgumentCaptor.forClass(String.class);
        verify(store,times(3)).append(ids.capture(),any(),any(),anyBoolean(),any(),any(),any(),any(),any(),any());
        assertThat(ids.getAllValues().get(0)).startsWith("recovery:").isEqualTo(ids.getAllValues().get(1));
        assertThat(ids.getAllValues().get(2)).isNotEqualTo(ids.getAllValues().get(0));
        assertThat(tenant.isSystemOrg()).isFalse();
        verify(stripe,never()).createTransfer(any(),any());
    }

    @Test void recoveryRejectsUnknownAccountAndModeMismatch() throws Exception {
        assertThatThrownBy(() -> handler.recover("acct_unknown",false,"po_bank",Instant.now())).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(stripe);
        when(store.isKnownAccount("acct_provider",true)).thenReturn(true);
        assertThatThrownBy(() -> handler.recover("acct_provider",true,"po_bank",Instant.now())).isInstanceOf(IllegalStateException.class);
        verify(store,never()).append(any(),any(),any(),anyBoolean(),any(),any(),any(),any(),any(),any());
        assertThat(tenant.isSystemOrg()).isFalse();
    }
}
