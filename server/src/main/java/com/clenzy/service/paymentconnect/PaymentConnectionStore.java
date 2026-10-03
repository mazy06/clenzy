package com.clenzy.service.paymentconnect;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.stripe.model.Account;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Optional;
import java.util.Objects;
import static com.clenzy.service.paymentconnect.PaymentConnectAccess.Beneficiary;

/** Short database transactions only. Stripe calls belong to PaymentConnectService. */
@Service
public class PaymentConnectionStore {
    private final PaymentConnectionRepository connections;
    private final OwnerPayoutConfigRepository owners;
    private final HousekeeperPayoutConfigRepository providers;

    public PaymentConnectionStore(PaymentConnectionRepository connections, OwnerPayoutConfigRepository owners,
                                  HousekeeperPayoutConfigRepository providers) {
        this.connections = connections;
        this.owners = owners;
        this.providers = providers;
    }

    public Optional<PaymentConnection> find(Beneficiary beneficiary) {
        return connections.findByOrganizationIdAndBeneficiaryKey(beneficiary.orgId(), beneficiary.key());
    }

    @Transactional
    public PaymentConnection prepare(Beneficiary b, String country) {
        PaymentConnection connection = find(b).orElseGet(() -> {
            var c = new PaymentConnection();
            c.setOrganizationId(b.orgId());
            c.setBeneficiaryKey(b.key());
            c.setUserId(b.userId());
            c.setCountry(country);
            // Reuse existing Baitly accounts; never create a duplicate during an upgrade.
            c.setProviderAccountId(legacyAccount(b).orElse(null));
            return c;
        });
        if (!country.equals(connection.getCountry())) throw new IllegalStateException("Account country cannot be changed");
        return connections.saveAndFlush(connection);
    }

    public Optional<String> legacyAccount(Beneficiary b) {
        if (b.userId() == null) return Optional.empty();
        if (isProvider(b.role())) return providers.findByUserIdAndOrganizationId(b.userId(), b.orgId())
                .map(HousekeeperPayoutConfig::getStripeAccountId);
        return owners.findByOwnerIdAndOrgId(b.userId(), b.orgId()).map(OwnerPayoutConfig::getStripeConnectedAccountId);
    }

    @Transactional
    public PaymentConnection attach(Beneficiary b, Account account) {
        PaymentConnection c = find(b).orElseThrow();
        if (c.getProviderAccountId() != null && !c.getProviderAccountId().equals(account.getId()))
            throw new IllegalStateException("A different payment account is already connected");
        if (!Objects.equals(c.getCountry(), account.getCountry()))
            throw new IllegalArgumentException("Stripe account country does not match the selected legal country");
        c.setProviderAccountId(account.getId());
        c.setAuthorized(true);
        apply(c, account);
        connections.saveAndFlush(c);
        syncLegacy(b, c);
        return c;
    }

    @Transactional
    public void accountUpdated(Account account) {
        connections.findByProviderAndProviderAccountId("STRIPE", account.getId()).ifPresent(c -> {
            if (c.isAuthorized()) apply(c, account);
            connections.save(c);
            syncStoredCapabilities(c);
        });
    }

    @Transactional
    public void deauthorize(String accountId) {
        connections.findByProviderAndProviderAccountId("STRIPE", accountId).ifPresent(c -> {
            c.setAuthorized(false);
            c.updateCapabilities(false, false, false, c.isDetailsSubmitted());
            connections.save(c);
            syncStoredCapabilities(c);
        });
    }

    private void syncStoredCapabilities(PaymentConnection c) {
        if (c.getUserId() == null) return;
        owners.findByStripeConnectedAccountId(c.getProviderAccountId()).ifPresent(config -> {
            config.setStripeOnboardingComplete(c.isReady());
            if (config.getPayoutMethod() == PayoutMethod.STRIPE_CONNECT) config.setVerified(c.isReady());
            owners.save(config);
        });
        providers.findByStripeAccountId(c.getProviderAccountId()).ifPresent(config -> {
            config.setOnboardingCompleted(c.isReady());
            providers.save(config);
        });
    }

    private static void apply(PaymentConnection c, Account account) {
        c.updateCapabilities(Boolean.TRUE.equals(account.getChargesEnabled()),
                Boolean.TRUE.equals(account.getPayoutsEnabled()),
                account.getCapabilities() != null && "active".equals(account.getCapabilities().getTransfers()),
                Boolean.TRUE.equals(account.getDetailsSubmitted()));
    }

    private void syncLegacy(Beneficiary b, PaymentConnection c) {
        if (b.userId() == null) return; // Organization money must never be paid to its administrator personally.
        if (isProvider(b.role())) {
            var config = providers.findByUserIdAndOrganizationId(b.userId(), b.orgId()).orElseGet(HousekeeperPayoutConfig::new);
            config.setUserId(b.userId());
            config.setOrganizationId(b.orgId());
            config.setStripeAccountId(c.getProviderAccountId());
            config.setOnboardingCompleted(c.isReady());
            providers.save(config);
            return;
        }
        var config = owners.findByOwnerIdAndOrgId(b.userId(), b.orgId()).orElseGet(OwnerPayoutConfig::new);
        config.setOwnerId(b.userId());
        config.setOrganizationId(b.orgId());
        config.setStripeConnectedAccountId(c.getProviderAccountId());
        // Do not replace an already configured bank/Wise payout method during Connect onboarding.
        if (config.getPayoutMethod() == PayoutMethod.MANUAL && !config.isVerified())
            config.setPayoutMethod(PayoutMethod.STRIPE_CONNECT);
        config.setStripeOnboardingComplete(c.isReady());
        if (config.getPayoutMethod() == PayoutMethod.STRIPE_CONNECT) config.setVerified(c.isReady());
        owners.save(config);
    }

    public static boolean isProvider(UserRole role) {
        return role == UserRole.HOUSEKEEPER || role == UserRole.TECHNICIAN || role == UserRole.LAUNDRY
                || role == UserRole.EXTERIOR_TECH || role == UserRole.SUPERVISOR;
    }
}
