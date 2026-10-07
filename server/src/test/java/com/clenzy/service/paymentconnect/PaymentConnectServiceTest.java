package com.clenzy.service.paymentconnect;

import com.clenzy.model.PaymentConnection;
import com.clenzy.model.UserRole;
import com.clenzy.payment.StripeGateway;
import com.stripe.model.Account;
import com.stripe.model.AccountLink;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import com.stripe.param.AccountCreateParams;
import com.stripe.param.AccountLinkCreateParams;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.clenzy.service.paymentconnect.PaymentConnectAccess.*;
import static com.clenzy.service.paymentconnect.PaymentConnectService.Intent.*;

class PaymentConnectServiceTest {
    final PaymentConnectAccess access = mock(PaymentConnectAccess.class);
    final PaymentConnectionStore store = mock(PaymentConnectionStore.class);
    final StripeGateway stripe = mock(StripeGateway.class);
    final PaymentConnectState states = mock(PaymentConnectState.class);
    final Beneficiary person = new Beneficiary(7L, 42L, 42L, "user:42", "person@example.test", UserRole.HOST);
    final PaymentConnectService service = new PaymentConnectService(access, store, stripe, states, "ca_test", "https://app.example.test");
    PaymentConnection connection;
    @BeforeEach void setUp() {
        when(access.resolve("subject", Scope.PERSONAL)).thenReturn(person);
        when(stripe.isConfigured()).thenReturn(true);
        connection = new PaymentConnection();
        connection.setCountry("FR");
        when(store.prepare(person, "FR")).thenReturn(connection);
        when(store.find(person)).thenReturn(Optional.of(connection));
    }
    @ParameterizedTest @ValueSource(strings={"MA", "SA", "US"})
    void regionalCountriesNeverCreateStripeAccounts(String country) {
        assertThatThrownBy(() -> service.start("subject", Scope.PERSONAL, country, CREATE)).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(stripe, states);
        verify(store, never()).prepare(any(), anyString());
    }
    @Test void creationIsIdempotentAndUsesTrustedReturnUrls() throws Exception {
        Account account = new Account(); account.setId("acct_new");
        when(stripe.createAccount(any(), anyString())).thenReturn(account);
        AccountLink link = new AccountLink(); link.setUrl("https://connect.stripe.com/setup");
        when(stripe.createAccountLink(any())).thenReturn(link);
        assertThat(service.start("subject", Scope.PERSONAL, "FR", CREATE)).isEqualTo(link.getUrl());
        var params = ArgumentCaptor.forClass(AccountCreateParams.class);
        verify(stripe).createAccount(params.capture(), eq("baitly-connect-" + connection.getId()));
        assertThat(params.getValue().getCountry()).isEqualTo("FR");
        assertThat(params.getValue().getCapabilities().getTransfers().getRequested()).isTrue();
        var urls = ArgumentCaptor.forClass(AccountLinkCreateParams.class);
        verify(stripe).createAccountLink(urls.capture());
        assertThat(urls.getValue().getReturnUrl()).isEqualTo("https://app.example.test/payment-connect/return?scope=PERSONAL&flow=return");
        verify(store).attach(person, account);
    }
    @Test void existingExpressAccountIsResumedWithoutCreatingAnother() throws Exception {
        connection.setProviderAccountId("acct_existing");
        Account account = new Account(); account.setId("acct_existing");
        when(stripe.retrieveAccount("acct_existing")).thenReturn(account);
        when(stripe.createAccountLink(any())).thenReturn(new AccountLink());
        service.start("subject", Scope.PERSONAL, "FR", CREATE);
        verify(stripe, never()).createAccount(any(), anyString());
    }
    @Test void standardAccountsResumeTheirOwnOnboardingAndReturnToBaitly() throws Exception {
        connection.setProviderAccountId("acct_standard");
        Account account = new Account(); account.setId("acct_standard"); account.setType("standard");
        when(stripe.retrieveAccount("acct_standard")).thenReturn(account);
        AccountLink link = new AccountLink(); link.setUrl("https://connect.stripe.com/setup/standard");
        when(stripe.createAccountLink(any())).thenReturn(link);
        assertThat(service.start("subject", Scope.PERSONAL, "FR", CREATE)).isEqualTo(link.getUrl());
        var params = ArgumentCaptor.forClass(AccountLinkCreateParams.class);
        verify(stripe).createAccountLink(params.capture());
        assertThat(params.getValue().getAccount()).isEqualTo("acct_standard");
        assertThat(params.getValue().getType()).isEqualTo(AccountLinkCreateParams.Type.ACCOUNT_ONBOARDING);
        assertThat(params.getValue().getReturnUrl()).isEqualTo("https://app.example.test/payment-connect/return?scope=PERSONAL&flow=return");
        assertThat(params.getValue().getRefreshUrl()).isEqualTo("https://app.example.test/payment-connect/return?scope=PERSONAL&flow=refresh");
        verify(stripe, never()).createAccount(any(), anyString());
        verifyNoInteractions(states);
    }
    @Test void connectionUsesBoundStateAndDoesNotCreateAnAccount() throws Exception {
        when(states.create(person)).thenReturn("one-time-state");
        String url = service.start("subject", Scope.PERSONAL, "FR", CONNECT);
        assertThat(url).startsWith("https://connect.stripe.com/oauth/authorize?").contains("state=one-time-state", "client_id=ca_test", "response_type=code");
        verify(stripe, never()).createAccount(any(), anyString());
    }
    @Test void rejectedStateCannotExchangeAnAuthorizationCode() {
        doThrow(new org.springframework.security.access.AccessDeniedException("expired")).when(states).consume("bad", person);
        assertThatThrownBy(() -> service.complete("subject", Scope.PERSONAL, "bad", "code")).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verifyNoInteractions(stripe);
    }
    @Test void returnRefreshDoesNotClaimReadinessFromAccountId() throws Exception {
        connection.setProviderAccountId("acct_pending");
        when(stripe.retrieveAccount("acct_pending")).thenReturn(new Account());
        assertThat(service.refresh("subject", Scope.PERSONAL).ready()).isFalse();
    }
    @Test void revokedAccountsRequireOAuthBeforeAnyRefresh() throws Exception {
        connection.setProviderAccountId("acct_revoked"); connection.setAuthorized(false);
        assertThat(service.refresh("subject", Scope.PERSONAL).reconnectRequired()).isTrue();
        verify(stripe, never()).retrieveAccount(anyString());
    }
}
