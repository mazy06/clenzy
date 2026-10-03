package com.clenzy.service.paymentconnect;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.stripe.model.Account;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class PaymentConnectionStoreTest {
    final PaymentConnectionRepository connections = mock(PaymentConnectionRepository.class);
    final OwnerPayoutConfigRepository owners = mock(OwnerPayoutConfigRepository.class);
    final HousekeeperPayoutConfigRepository providers = mock(HousekeeperPayoutConfigRepository.class);
    final PaymentConnectionStore store = new PaymentConnectionStore(connections, owners, providers);
    final PaymentConnectAccess.Beneficiary person = new PaymentConnectAccess.Beneficiary(7L, 42L, 42L, "user:42", null, UserRole.PROPERTY_OWNER);
    PaymentConnection existing(PaymentConnectAccess.Beneficiary b) {
        PaymentConnection c = new PaymentConnection(); c.setCountry("FR"); c.setUserId(b.userId()); c.setOrganizationId(b.orgId());
        when(connections.findByOrganizationIdAndBeneficiaryKey(b.orgId(), b.key())).thenReturn(Optional.of(c));
        return c;
    }
    Account account() {
        Account a = new Account(); a.setCountry("FR"); a.setId("acct_test"); a.setPayoutsEnabled(true); a.setDetailsSubmitted(true);
        Account.Capabilities caps = new Account.Capabilities(); caps.setTransfers("active"); a.setCapabilities(caps);
        return a;
    }
    @Test void pendingTransfersCannotActivateLegacyPayouts() {
        existing(person); Account a = account(); a.getCapabilities().setTransfers("pending");
        OwnerPayoutConfig cfg = new OwnerPayoutConfig();
        when(owners.findByOwnerIdAndOrgId(42L, 7L)).thenReturn(Optional.of(cfg));
        assertThat(store.attach(person, a).isReady()).isFalse();
        assertThat(cfg.isVerified()).isFalse();
    }
    @Test void verifiedOwnerAccountFeedsExistingPayoutEngine() {
        existing(person); OwnerPayoutConfig cfg = new OwnerPayoutConfig();
        when(owners.findByOwnerIdAndOrgId(42L, 7L)).thenReturn(Optional.of(cfg));
        assertThat(store.attach(person, account()).isReady()).isTrue();
        assertThat(cfg.getStripeConnectedAccountId()).isEqualTo("acct_test");
        assertThat(cfg.getPayoutMethod()).isEqualTo(PayoutMethod.STRIPE_CONNECT);
        assertThat(cfg.isVerified()).isTrue();
    }
    @Test void organizationAccountNeverOverwritesAdministratorPersonalPayout() {
        var org = new PaymentConnectAccess.Beneficiary(7L, 42L, null, "organization", null, UserRole.SUPER_MANAGER);
        existing(org);
        assertThat(store.attach(org, account()).isReady()).isTrue();
        verifyNoInteractions(owners, providers);
    }
    @Test void neitherForeignCountriesNorAccountReplacementAreAccepted() {
        PaymentConnection c = existing(person); Account a = account(); a.setCountry("US");
        assertThatThrownBy(() -> store.attach(person, a)).isInstanceOf(IllegalArgumentException.class);
        a.setCountry("FR"); c.setProviderAccountId("acct_other");
        assertThatThrownBy(() -> store.attach(person, a)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(owners, providers);
    }
    @Test void deauthorizationDisablesLegacyPayoutsAndIgnoresLateAccountUpdates() {
        PaymentConnection c = existing(person); c.setProviderAccountId("acct_test"); c.updateCapabilities(true,true,true,true);
        OwnerPayoutConfig cfg = new OwnerPayoutConfig(); cfg.setPayoutMethod(PayoutMethod.STRIPE_CONNECT); cfg.setVerified(true);
        when(connections.findByProviderAndProviderAccountId("STRIPE", "acct_test")).thenReturn(Optional.of(c));
        when(owners.findByStripeConnectedAccountId("acct_test")).thenReturn(Optional.of(cfg));
        store.deauthorize("acct_test");
        assertThat(c.isReady()).isFalse(); assertThat(cfg.isVerified()).isFalse();
        store.accountUpdated(account());
        assertThat(c.isReady()).isFalse(); assertThat(cfg.isVerified()).isFalse();
    }
    @Test void startingAndCompletingConnectPreservesAnExistingVerifiedBankMethod() {
        existing(person); var cfg = new OwnerPayoutConfig();
        cfg.setPayoutMethod(PayoutMethod.SEPA_TRANSFER); cfg.setVerified(true);
        when(owners.findByOwnerIdAndOrgId(42L, 7L)).thenReturn(Optional.of(cfg));
        Account a = account(); a.setPayoutsEnabled(false);
        store.attach(person,a);
        assertThat(cfg.getPayoutMethod()).isEqualTo(PayoutMethod.SEPA_TRANSFER);
        assertThat(cfg.isVerified()).isTrue();
        a.setPayoutsEnabled(true); store.attach(person,a);
        assertThat(cfg.getPayoutMethod()).isEqualTo(PayoutMethod.SEPA_TRANSFER);
        assertThat(cfg.isVerified()).isTrue();
    }
}
