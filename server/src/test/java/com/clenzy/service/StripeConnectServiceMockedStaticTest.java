package com.clenzy.service;

import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import com.clenzy.model.User;
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
import org.mockito.MockedStatic;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Extension de {@link StripeConnectServiceTest} qui couvre les chemins
 * appelant le SDK Stripe (Account.create, AccountLink.create, Transfer.create).
 *
 * <p>Utilise {@code mockStatic} pour intercepter les appels statiques au SDK
 * et permettre le test des branches de creation d'account, generation de
 * lien d'onboarding et creation de transfer.</p>
 */
@ExtendWith(MockitoExtension.class)
class StripeConnectServiceMockedStaticTest {

    @Mock private OwnerPayoutConfigRepository configRepository;
    @Mock private UserRepository userRepository;

    private StripeConnectService service;

    @BeforeEach
    void setUp() {
        service = new StripeConnectService(configRepository, userRepository);
        ReflectionTestUtils.setField(service, "secretKey", "sk_test_x");
        ReflectionTestUtils.setField(service, "returnUrl", "https://app.clenzy.com/ret");
        ReflectionTestUtils.setField(service, "refreshUrl", "https://app.clenzy.com/ref");
    }

    private static OwnerPayoutConfig cfg(boolean complete, String stripeId) {
        OwnerPayoutConfig c = new OwnerPayoutConfig();
        c.setOrganizationId(7L);
        c.setOwnerId(11L);
        c.setStripeConnectedAccountId(stripeId);
        c.setStripeOnboardingComplete(complete);
        return c;
    }

    // ─── createConnectedAccount ──────────────────────────────────────────

    @Test
    @DisplayName("createConnectedAccount creates new config + Stripe account when none exists")
    void createConnectedAccount_noExistingConfig_createsNew() throws Exception {
        when(configRepository.findByOwnerIdAndOrgId(11L, 7L)).thenReturn(Optional.empty());
        User owner = new User();
        owner.setEmail("owner@example.com");
        when(userRepository.findById(11L)).thenReturn(Optional.of(owner));

        Account acct = mock(Account.class);
        when(acct.getId()).thenReturn("acct_new123");
        when(configRepository.save(any(OwnerPayoutConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        try (MockedStatic<Account> mocked = mockStatic(Account.class)) {
            mocked.when(() -> Account.create(any(AccountCreateParams.class))).thenReturn(acct);

            OwnerPayoutConfig result = service.createConnectedAccount(11L, 7L);

            assertThat(result.getStripeConnectedAccountId()).isEqualTo("acct_new123");
            assertThat(result.getPayoutMethod()).isEqualTo(PayoutMethod.STRIPE_CONNECT);
            assertThat(result.isStripeOnboardingComplete()).isFalse();
            assertThat(result.getOrganizationId()).isEqualTo(7L);
            assertThat(result.getOwnerId()).isEqualTo(11L);
            verify(configRepository).save(any(OwnerPayoutConfig.class));
        }
    }

    @Test
    @DisplayName("createConnectedAccount tolerates missing user (no email pre-fill)")
    void createConnectedAccount_missingUser_noEmailPreFill() throws Exception {
        when(configRepository.findByOwnerIdAndOrgId(11L, 7L)).thenReturn(Optional.empty());
        when(userRepository.findById(11L)).thenReturn(Optional.empty());

        Account acct = mock(Account.class);
        when(acct.getId()).thenReturn("acct_noEmail");
        when(configRepository.save(any(OwnerPayoutConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        try (MockedStatic<Account> mocked = mockStatic(Account.class)) {
            mocked.when(() -> Account.create(any(AccountCreateParams.class))).thenReturn(acct);

            OwnerPayoutConfig result = service.createConnectedAccount(11L, 7L);
            assertThat(result.getStripeConnectedAccountId()).isEqualTo("acct_noEmail");
        }
    }

    @Test
    @DisplayName("createConnectedAccount reuses existing config row when present without Stripe id")
    void createConnectedAccount_existingConfigNoStripeId_addsStripeId() throws Exception {
        OwnerPayoutConfig existing = cfg(false, null);
        when(configRepository.findByOwnerIdAndOrgId(11L, 7L)).thenReturn(Optional.of(existing));

        User owner = new User();
        owner.setEmail("o@example.com");
        when(userRepository.findById(11L)).thenReturn(Optional.of(owner));

        Account acct = mock(Account.class);
        when(acct.getId()).thenReturn("acct_added");
        when(configRepository.save(any(OwnerPayoutConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        try (MockedStatic<Account> mocked = mockStatic(Account.class)) {
            mocked.when(() -> Account.create(any(AccountCreateParams.class))).thenReturn(acct);

            OwnerPayoutConfig result = service.createConnectedAccount(11L, 7L);
            assertThat(result).isSameAs(existing);
            assertThat(result.getStripeConnectedAccountId()).isEqualTo("acct_added");
            assertThat(result.getPayoutMethod()).isEqualTo(PayoutMethod.STRIPE_CONNECT);
        }
    }

    // ─── generateOnboardingLink ──────────────────────────────────────────

    @Test
    @DisplayName("generateOnboardingLink returns the URL from Stripe AccountLink")
    void generateOnboardingLink_returnsUrl() throws Exception {
        AccountLink link = mock(AccountLink.class);
        when(link.getUrl()).thenReturn("https://connect.stripe.com/onboarding/abc");

        try (MockedStatic<AccountLink> mocked = mockStatic(AccountLink.class)) {
            mocked.when(() -> AccountLink.create(any(AccountLinkCreateParams.class))).thenReturn(link);

            String url = service.generateOnboardingLink("acct_xyz");

            assertThat(url).isEqualTo("https://connect.stripe.com/onboarding/abc");
        }
    }

    // ─── createTransfer ──────────────────────────────────────────────────

    @Test
    @DisplayName("createTransfer converts amount to cents (HALF_UP) and lowercases currency")
    void createTransfer_convertsAmountAndCurrency() throws Exception {
        Transfer transfer = mock(Transfer.class);
        when(transfer.getId()).thenReturn("tr_001");

        try (MockedStatic<Transfer> mocked = mockStatic(Transfer.class)) {
            ArgumentCaptor<TransferCreateParams> captor =
                    ArgumentCaptor.forClass(TransferCreateParams.class);
            mocked.when(() -> Transfer.create(captor.capture())).thenReturn(transfer);

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
    }

    @Test
    @DisplayName("createTransfer with uppercase currency input gets lowercased")
    void createTransfer_uppercaseCurrency_lowercased() throws Exception {
        Transfer transfer = mock(Transfer.class);
        when(transfer.getId()).thenReturn("tr_002");

        try (MockedStatic<Transfer> mocked = mockStatic(Transfer.class)) {
            ArgumentCaptor<TransferCreateParams> captor =
                    ArgumentCaptor.forClass(TransferCreateParams.class);
            mocked.when(() -> Transfer.create(captor.capture())).thenReturn(transfer);

            service.createTransfer(BigDecimal.TEN, "USD", "acct_x", "desc");

            assertThat(captor.getValue().getCurrency()).isEqualTo("usd");
        }
    }

    @Test
    @DisplayName("createTransfer propagates StripeException on API error")
    void createTransfer_stripeError_propagated() {
        try (MockedStatic<Transfer> mocked = mockStatic(Transfer.class)) {
            StripeException ex = new ApiException("Insufficient funds", null, "fund_err", 402, null);
            mocked.when(() -> Transfer.create(any(TransferCreateParams.class))).thenThrow(ex);

            assertThatThrownBy(() ->
                    service.createTransfer(BigDecimal.ONE, "EUR", "acct_x", "desc"))
                    .isInstanceOf(StripeException.class)
                    .hasMessageContaining("Insufficient funds");
        }
    }

    @Test
    @DisplayName("handleAccountUpdated regression from complete to not-complete updates flag")
    void handleAccountUpdated_regressFromCompleteToIncomplete() {
        OwnerPayoutConfig config = cfg(true, "acct_regress");
        when(configRepository.findByStripeConnectedAccountId("acct_regress"))
                .thenReturn(Optional.of(config));

        service.handleAccountUpdated("acct_regress", false, true);

        assertThat(config.isStripeOnboardingComplete()).isFalse();
        verify(configRepository).save(config);
    }
}
