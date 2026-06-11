package com.clenzy.service;

import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import com.clenzy.payment.StripeAmounts;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.OwnerPayoutConfigRepository;
import com.clenzy.repository.UserRepository;
import com.stripe.exception.StripeException;
import com.stripe.model.Account;
import com.stripe.model.AccountLink;
import com.stripe.model.Transfer;
import com.stripe.param.AccountCreateParams;
import com.stripe.param.AccountLinkCreateParams;
import com.stripe.param.TransferCreateParams;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
public class StripeConnectService {

    private static final Logger log = LoggerFactory.getLogger(StripeConnectService.class);

    @Value("${stripe.connect.return-url:https://app.clenzy.com/settings?tab=8}")
    private String returnUrl;

    @Value("${stripe.connect.refresh-url:https://app.clenzy.com/settings?tab=8&refresh=true}")
    private String refreshUrl;

    private final OwnerPayoutConfigRepository configRepository;
    private final UserRepository userRepository;
    private final StripeGateway stripeGateway;

    public StripeConnectService(OwnerPayoutConfigRepository configRepository,
                                UserRepository userRepository,
                                StripeGateway stripeGateway) {
        this.configRepository = configRepository;
        this.userRepository = userRepository;
        this.stripeGateway = stripeGateway;
    }

    /**
     * Creates a Stripe Express connected account for an owner and stores the account ID.
     */
    @Transactional
    @CircuitBreaker(name = "stripe-api")
    public OwnerPayoutConfig createConnectedAccount(Long ownerId, Long orgId) throws StripeException {
        OwnerPayoutConfig config = configRepository.findByOwnerIdAndOrgId(ownerId, orgId)
                .orElseGet(() -> {
                    OwnerPayoutConfig c = new OwnerPayoutConfig();
                    c.setOrganizationId(orgId);
                    c.setOwnerId(ownerId);
                    return c;
                });

        if (config.getStripeConnectedAccountId() != null) {
            log.info("Owner {} already has a Stripe Connect account: {}", ownerId, config.getStripeConnectedAccountId());
            return config;
        }

        // Resolve owner email for pre-filling
        String email = userRepository.findById(ownerId)
                .map(u -> u.getEmail())
                .orElse(null);

        AccountCreateParams.Builder params = AccountCreateParams.builder()
                .setType(AccountCreateParams.Type.EXPRESS)
                .setCountry("FR")
                .setCapabilities(AccountCreateParams.Capabilities.builder()
                        .setTransfers(AccountCreateParams.Capabilities.Transfers.builder()
                                .setRequested(true)
                                .build())
                        .build());

        if (email != null) {
            params.setEmail(email);
        }

        Account account = stripeGateway.createAccount(params.build());

        config.setStripeConnectedAccountId(account.getId());
        config.setPayoutMethod(PayoutMethod.STRIPE_CONNECT);
        config.setStripeOnboardingComplete(false);

        log.info("Created Stripe Connect account {} for owner {}", account.getId(), ownerId);
        return configRepository.save(config);
    }

    /**
     * Generates a Stripe onboarding link for the connected account.
     */
    @CircuitBreaker(name = "stripe-api")
    public String generateOnboardingLink(String connectedAccountId) throws StripeException {
        AccountLinkCreateParams params = AccountLinkCreateParams.builder()
                .setAccount(connectedAccountId)
                .setRefreshUrl(refreshUrl)
                .setReturnUrl(returnUrl)
                .setType(AccountLinkCreateParams.Type.ACCOUNT_ONBOARDING)
                .build();

        AccountLink link = stripeGateway.createAccountLink(params);
        return link.getUrl();
    }

    /**
     * Creates a transfer to a connected account (payout execution).
     * Amount is in cents (EUR smallest unit).
     */
    @CircuitBreaker(name = "stripe-api")
    public Transfer createTransfer(BigDecimal amount, String currency,
                                    String connectedAccountId, String description) throws StripeException {
        long amountInCents = StripeAmounts.toMinorUnits(amount);

        TransferCreateParams params = TransferCreateParams.builder()
                .setAmount(amountInCents)
                .setCurrency(currency.toLowerCase())
                .setDestination(connectedAccountId)
                .setDescription(description)
                .build();

        Transfer transfer = stripeGateway.createTransfer(params, null);
        log.info("Created Stripe transfer {} of {} {} to account {}",
                transfer.getId(), amount, currency, connectedAccountId);
        return transfer;
    }

    /**
     * Handles Stripe account.updated webhook event.
     * Updates the onboarding completion status.
     */
    @Transactional
    public void handleAccountUpdated(String accountId, boolean chargesEnabled, boolean payoutsEnabled) {
        configRepository.findByStripeConnectedAccountId(accountId)
                .ifPresent(config -> {
                    boolean wasComplete = config.isStripeOnboardingComplete();
                    boolean nowComplete = chargesEnabled && payoutsEnabled;
                    config.setStripeOnboardingComplete(nowComplete);
                    if (nowComplete) {
                        config.setVerified(true);
                    }
                    configRepository.save(config);
                    if (!wasComplete && nowComplete) {
                        log.info("Stripe Connect onboarding completed for account {}", accountId);
                    }
                });
    }
}
