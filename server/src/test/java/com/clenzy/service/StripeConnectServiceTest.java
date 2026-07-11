package com.clenzy.service;

import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import com.clenzy.model.User;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.OwnerPayoutConfigRepository;
import com.clenzy.repository.UserRepository;
import com.stripe.exception.ApiException;
import com.stripe.exception.StripeException;
import com.stripe.model.Account;
import com.stripe.model.AccountLink;
import com.stripe.model.Transfer;
import com.stripe.param.AccountCreateParams;
import com.stripe.param.AccountLinkCreateParams;
import com.stripe.param.TransferCreateParams;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StripeConnectServiceTest {

    @Mock private OwnerPayoutConfigRepository configRepository;
    @Mock private UserRepository userRepository;
    @Mock private StripeGateway stripeGateway;

    private StripeConnectService service;

    @BeforeEach
    void setUp() {
        service = new StripeConnectService(configRepository, userRepository, stripeGateway,
                new org.springframework.beans.factory.support.StaticListableBeanFactory().getBeanProvider(com.clenzy.service.payout.HousekeeperPayoutService.class));
    }

    private static OwnerPayoutConfig cfg(boolean complete, String stripeId) {
        OwnerPayoutConfig c = new OwnerPayoutConfig();
        c.setOrganizationId(7L);
        c.setOwnerId(11L);
        c.setStripeConnectedAccountId(stripeId);
        c.setStripeOnboardingComplete(complete);
        return c;
    }

    @Test
    void handleAccountUpdated_completesOnboarding_setsVerifiedAndSaves() {
        OwnerPayoutConfig config = cfg(false, "acct_123");
        when(configRepository.findByStripeConnectedAccountId("acct_123"))
                .thenReturn(Optional.of(config));

        service.handleAccountUpdated("acct_123", true, true);

        assertThat(config.isStripeOnboardingComplete()).isTrue();
        assertThat(config.isVerified()).isTrue();
        verify(configRepository).save(config);
    }

    @Test
    void handleAccountUpdated_partialCapabilities_notComplete() {
        OwnerPayoutConfig config = cfg(false, "acct_x");
        when(configRepository.findByStripeConnectedAccountId("acct_x"))
                .thenReturn(Optional.of(config));

        service.handleAccountUpdated("acct_x", true, false);

        assertThat(config.isStripeOnboardingComplete()).isFalse();
        assertThat(config.isVerified()).isFalse();
        verify(configRepository).save(config);
    }

    @Test
    void handleAccountUpdated_unknownAccount_silentNoOp() {
        when(configRepository.findByStripeConnectedAccountId("acct_zzz"))
                .thenReturn(Optional.empty());

        service.handleAccountUpdated("acct_zzz", true, true);

        verify(configRepository, never()).save(any());
    }

    @Test
    void handleAccountUpdated_alreadyCompleteNowComplete_savesIdempotently() {
        OwnerPayoutConfig config = cfg(true, "acct_y");
        when(configRepository.findByStripeConnectedAccountId("acct_y"))
                .thenReturn(Optional.of(config));

        service.handleAccountUpdated("acct_y", true, true);

        // Saved (status overwritten) without going through 'newly complete' log path.
        verify(configRepository).save(config);
        assertThat(config.isStripeOnboardingComplete()).isTrue();
    }

    @Test
    void createConnectedAccount_existingStripeAccount_shortCircuits() throws Exception {
        OwnerPayoutConfig existing = cfg(false, "acct_existing");
        when(configRepository.findByOwnerIdAndOrgId(11L, 7L))
                .thenReturn(Optional.of(existing));

        OwnerPayoutConfig result = service.createConnectedAccount(11L, 7L);

        assertThat(result).isSameAs(existing);
        assertThat(result.getStripeConnectedAccountId()).isEqualTo("acct_existing");
        verify(configRepository, never()).save(any());
        verify(userRepository, never()).findById(any());
    }

    // ─── createConnectedAccount (Stripe SDK mocked statically) ───────────

    @Test
    @DisplayName("createConnectedAccount creates new config when no existing one")
    void createConnectedAccount_noExistingConfig_createsNew() throws Exception {
        when(configRepository.findByOwnerIdAndOrgId(11L, 7L)).thenReturn(Optional.empty());

        User owner = new User();
        owner.setEmail("owner@example.com");
        when(userRepository.findById(11L)).thenReturn(Optional.of(owner));

        Account acct = mock(Account.class);
        when(acct.getId()).thenReturn("acct_new123");
        when(configRepository.save(any(OwnerPayoutConfig.class))).thenAnswer(inv -> inv.getArgument(0));
        when(stripeGateway.createAccount(any(AccountCreateParams.class))).thenReturn(acct);

        OwnerPayoutConfig result = service.createConnectedAccount(11L, 7L);

        assertThat(result.getStripeConnectedAccountId()).isEqualTo("acct_new123");
        assertThat(result.getPayoutMethod()).isEqualTo(PayoutMethod.STRIPE_CONNECT);
        assertThat(result.isStripeOnboardingComplete()).isFalse();
        assertThat(result.getOrganizationId()).isEqualTo(7L);
        assertThat(result.getOwnerId()).isEqualTo(11L);
        verify(configRepository).save(any(OwnerPayoutConfig.class));
    }

    @Test
    @DisplayName("createConnectedAccount handles missing user (no email pre-fill)")
    void createConnectedAccount_userMissing_noEmailPrefill() throws Exception {
        when(configRepository.findByOwnerIdAndOrgId(11L, 7L)).thenReturn(Optional.empty());
        when(userRepository.findById(11L)).thenReturn(Optional.empty());

        Account acct = mock(Account.class);
        when(acct.getId()).thenReturn("acct_no_email");
        when(configRepository.save(any(OwnerPayoutConfig.class))).thenAnswer(inv -> inv.getArgument(0));
        when(stripeGateway.createAccount(any(AccountCreateParams.class))).thenReturn(acct);

        OwnerPayoutConfig result = service.createConnectedAccount(11L, 7L);

        assertThat(result.getStripeConnectedAccountId()).isEqualTo("acct_no_email");
    }

    @Test
    @DisplayName("createConnectedAccount reuses existing config row, only sets stripe id")
    void createConnectedAccount_existingConfigNoStripeId_addsStripeId() throws Exception {
        OwnerPayoutConfig existing = cfg(false, null); // no stripe id yet
        when(configRepository.findByOwnerIdAndOrgId(11L, 7L)).thenReturn(Optional.of(existing));

        User owner = new User();
        owner.setEmail("o@example.com");
        when(userRepository.findById(11L)).thenReturn(Optional.of(owner));

        Account acct = mock(Account.class);
        when(acct.getId()).thenReturn("acct_added");
        when(configRepository.save(any(OwnerPayoutConfig.class))).thenAnswer(inv -> inv.getArgument(0));
        when(stripeGateway.createAccount(any(AccountCreateParams.class))).thenReturn(acct);

        OwnerPayoutConfig result = service.createConnectedAccount(11L, 7L);

        assertThat(result).isSameAs(existing);
        assertThat(result.getStripeConnectedAccountId()).isEqualTo("acct_added");
        assertThat(result.getPayoutMethod()).isEqualTo(PayoutMethod.STRIPE_CONNECT);
    }

    // ─── generateOnboardingLink ──────────────────────────────────────────

    @Test
    @DisplayName("generateOnboardingLink returns the URL from Stripe")
    void generateOnboardingLink_returnsUrl() throws Exception {
        ReflectionTestUtils.setField(service, "returnUrl", "https://app.clenzy.com/ret");
        ReflectionTestUtils.setField(service, "refreshUrl", "https://app.clenzy.com/ref");

        AccountLink link = mock(AccountLink.class);
        when(link.getUrl()).thenReturn("https://connect.stripe.com/onboarding/abc");
        when(stripeGateway.createAccountLink(any(AccountLinkCreateParams.class))).thenReturn(link);

        String url = service.generateOnboardingLink("acct_xyz");

        assertThat(url).isEqualTo("https://connect.stripe.com/onboarding/abc");
    }

    // ─── createTransfer ──────────────────────────────────────────────────

    @Test
    @DisplayName("createTransfer converts EUR amount to cents (HALF_UP) and lowercases currency")
    void createTransfer_convertsAmountAndCurrency() throws Exception {
        Transfer transfer = mock(Transfer.class);
        when(transfer.getId()).thenReturn("tr_001");

        ArgumentCaptor<TransferCreateParams> captor =
                ArgumentCaptor.forClass(TransferCreateParams.class);
        when(stripeGateway.createTransfer(captor.capture(), isNull())).thenReturn(transfer);

        Transfer result = service.createTransfer(
                new BigDecimal("125.674"), "EUR", "acct_dest", "payout-test");

        assertThat(result).isSameAs(transfer);
        TransferCreateParams params = captor.getValue();
        // 125.674 * 100 = 12567.40 -> HALF_UP -> 12567
        assertThat(params.getAmount()).isEqualTo(12567L);
        assertThat(params.getCurrency()).isEqualTo("eur");
        assertThat(params.getDestination()).isEqualTo("acct_dest");
        assertThat(params.getDescription()).isEqualTo("payout-test");
    }

    @Test
    @DisplayName("createTransfer handles upper-case currency input by lowercasing")
    void createTransfer_uppercaseCurrency_lowercased() throws Exception {
        Transfer transfer = mock(Transfer.class);
        when(transfer.getId()).thenReturn("tr_002");

        ArgumentCaptor<TransferCreateParams> captor =
                ArgumentCaptor.forClass(TransferCreateParams.class);
        when(stripeGateway.createTransfer(captor.capture(), isNull())).thenReturn(transfer);

        service.createTransfer(BigDecimal.TEN, "USD", "acct_x", "desc");

        assertThat(captor.getValue().getCurrency()).isEqualTo("usd");
    }

    @Test
    @DisplayName("createTransfer propagates StripeException")
    void createTransfer_stripeError_propagated() throws Exception {
        StripeException ex = new ApiException("Insufficient funds", null, "fund_err", 402, null);
        when(stripeGateway.createTransfer(any(TransferCreateParams.class), isNull())).thenThrow(ex);

        assertThatThrownBy(() ->
                service.createTransfer(BigDecimal.ONE, "EUR", "acct_x", "desc"))
                .isInstanceOf(StripeException.class)
                .hasMessageContaining("Insufficient funds");
    }

    // ─── Webhook : Idempotence (already complete + still complete) ──────

    @Test
    @DisplayName("handleAccountUpdated already complete + still complete => still saved, no extra log")
    void handleAccountUpdated_alreadyCompleteStillComplete_idempotent() {
        OwnerPayoutConfig config = cfg(true, "acct_iter");
        when(configRepository.findByStripeConnectedAccountId("acct_iter"))
                .thenReturn(Optional.of(config));

        service.handleAccountUpdated("acct_iter", true, true);

        assertThat(config.isStripeOnboardingComplete()).isTrue();
        verify(configRepository).save(config);
    }

    @Test
    @DisplayName("handleAccountUpdated regression from complete to incomplete updates flag")
    void handleAccountUpdated_regressFromCompleteToIncomplete() {
        OwnerPayoutConfig config = cfg(true, "acct_regress");
        when(configRepository.findByStripeConnectedAccountId("acct_regress"))
                .thenReturn(Optional.of(config));

        service.handleAccountUpdated("acct_regress", false, true);

        // It was complete; now charges=false -> nowComplete=false
        assertThat(config.isStripeOnboardingComplete()).isFalse();
        verify(configRepository).save(config);
    }

    @Test
    void unusedMethods_payoutMethodConstantExposed() {
        // Defensive smoke: ensure the enum constants are stable so future refactors trip the test.
        assertThat(PayoutMethod.STRIPE_CONNECT.name()).isEqualTo("STRIPE_CONNECT");
    }
}
