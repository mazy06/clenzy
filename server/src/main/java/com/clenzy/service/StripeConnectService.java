package com.clenzy.service;

import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import com.clenzy.repository.OwnerPayoutConfigRepository;
import com.clenzy.repository.UserRepository;
import com.stripe.Stripe;
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
import java.math.RoundingMode;

@Service
public class StripeConnectService {

    private static final Logger log = LoggerFactory.getLogger(StripeConnectService.class);

    @Value("${stripe.secret-key:}")
    private String secretKey;

    @Value("${stripe.connect.return-url:https://app.clenzy.com/settings?tab=8}")
    private String returnUrl;

    @Value("${stripe.connect.refresh-url:https://app.clenzy.com/settings?tab=8&refresh=true}")
    private String refreshUrl;

    private final OwnerPayoutConfigRepository configRepository;
    private final UserRepository userRepository;

    public StripeConnectService(OwnerPayoutConfigRepository configRepository,
                                UserRepository userRepository) {
        this.configRepository = configRepository;
        this.userRepository = userRepository;
    }

    /**
     * Creates a Stripe Express connected account for an owner and stores the account ID.
     */
    @Transactional
    @CircuitBreaker(name = "stripe-api")
    public OwnerPayoutConfig createConnectedAccount(Long ownerId, Long orgId) throws StripeException {
        Stripe.apiKey = secretKey;

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

        Account account = Account.create(params.build());

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
        Stripe.apiKey = secretKey;

        AccountLinkCreateParams params = AccountLinkCreateParams.builder()
                .setAccount(connectedAccountId)
                .setRefreshUrl(refreshUrl)
                .setReturnUrl(returnUrl)
                .setType(AccountLinkCreateParams.Type.ACCOUNT_ONBOARDING)
                .build();

        AccountLink link = AccountLink.create(params);
        return link.getUrl();
    }

    /**
     * Creates a transfer to a connected account (payout execution).
     * Amount is in cents (EUR smallest unit).
     */
    @CircuitBreaker(name = "stripe-api")
    public Transfer createTransfer(BigDecimal amount, String currency,
                                    String connectedAccountId, String description) throws StripeException {
        Stripe.apiKey = secretKey;

        long amountInCents = amount.multiply(BigDecimal.valueOf(100))
                .setScale(0, RoundingMode.HALF_UP)
                .longValueExact();

        TransferCreateParams params = TransferCreateParams.builder()
                .setAmount(amountInCents)
                .setCurrency(currency.toLowerCase())
                .setDestination(connectedAccountId)
                .setDescription(description)
                .build();

        Transfer transfer = Transfer.create(params);
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
