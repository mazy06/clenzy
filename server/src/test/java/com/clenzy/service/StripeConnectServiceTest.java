package com.clenzy.service;

import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import com.clenzy.model.User;
import com.clenzy.repository.OwnerPayoutConfigRepository;
import com.clenzy.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StripeConnectServiceTest {

    @Mock private OwnerPayoutConfigRepository configRepository;
    @Mock private UserRepository userRepository;

    private StripeConnectService service;

    @BeforeEach
    void setUp() {
        service = new StripeConnectService(configRepository, userRepository);
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

    // Note: createConnectedAccount + generateOnboardingLink + createTransfer all call into the
    // real Stripe SDK (Stripe.apiKey = ..., Account.create(...)). We exercise the short-circuit
    // path above; the full happy paths cannot be tested without mocking Stripe HTTP calls
    // (Stripe Java SDK has no clean injection point for tests in this version). The webhook
    // handler path and idempotence guard cover the bulk of business logic.

    @Test
    void unusedMethods_payoutMethodConstantExposed() {
        // Defensive smoke: ensure the enum constants are stable so future refactors trip the test.
        assertThat(PayoutMethod.STRIPE_CONNECT.name()).isEqualTo("STRIPE_CONNECT");
    }
}
