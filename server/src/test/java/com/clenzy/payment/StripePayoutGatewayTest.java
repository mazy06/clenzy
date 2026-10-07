package com.clenzy.payment;

import com.stripe.StripeClient;
import com.stripe.net.RequestOptions;
import com.stripe.param.BalanceTransactionListParams;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class StripePayoutGatewayTest {
    @Test void recoveryUsesFixedCreatedWindowAndBoundedConnectedPage() throws Exception {
        try(var clients=mockConstruction(StripeClient.class,withSettings().defaultAnswer(RETURNS_DEEP_STUBS))) {
            new StripeGateway("sk_test_baitly_fake").listConnectedPayouts("acct_company",100L,500L,"po_previous");
            var params=ArgumentCaptor.forClass(com.stripe.param.PayoutListParams.class);
            var options=ArgumentCaptor.forClass(RequestOptions.class);
            verify(clients.constructed().getFirst().payouts()).list(params.capture(),options.capture());
            assertThat(params.getValue().getLimit()).isEqualTo(25L);
            assertThat(params.getValue().getStartingAfter()).isEqualTo("po_previous");
            var window=(com.stripe.param.PayoutListParams.Created)params.getValue().getCreated();
            assertThat(window.getGte()).isEqualTo(100L);assertThat(window.getLte()).isEqualTo(500L);
            assertThat(options.getValue().getStripeAccount()).isEqualTo("acct_company");
        }
    }
    @Test void platformBalanceIsNeverReadAsAConnectedAccount() throws Exception {
        try(var clients=mockConstruction(StripeClient.class,withSettings().defaultAnswer(RETURNS_DEEP_STUBS))) {
            var gateway=new StripeGateway("sk_test_baitly_fake");
            gateway.retrievePlatformBalance();
            verify(clients.constructed().getFirst().balance()).retrieve();
        }
    }

    @Test void payoutReadsAndPaginationAlwaysCarryTheExactConnectedAccount() throws Exception {
        try(var clients=mockConstruction(StripeClient.class,withSettings().defaultAnswer(RETURNS_DEEP_STUBS))) {
            var gateway=new StripeGateway("sk_test_baitly_fake");
            gateway.retrieveConnectedPayout("acct_company","po_123");
            var account=ArgumentCaptor.forClass(RequestOptions.class);
            verify(clients.constructed().getFirst().payouts()).retrieve(eq("po_123"),account.capture());
            assertThat(account.getValue().getStripeAccount()).isEqualTo("acct_company");
            gateway.listConnectedPayoutTransactions("acct_company","po_123","txn_last");
            var params=ArgumentCaptor.forClass(BalanceTransactionListParams.class);
            verify(clients.constructed().get(1).balanceTransactions()).list(params.capture(),account.capture());
            assertThat(params.getValue().getPayout()).isEqualTo("po_123");
            assertThat(params.getValue().getStartingAfter()).isEqualTo("txn_last");
            assertThat(params.getValue().getLimit()).isEqualTo(100L);
            assertThat(account.getValue().getStripeAccount()).isEqualTo("acct_company");
            assertThatThrownBy(() -> gateway.retrieveConnectedPayout(null,"po_123")).isInstanceOf(IllegalArgumentException.class);
        }
    }
}
