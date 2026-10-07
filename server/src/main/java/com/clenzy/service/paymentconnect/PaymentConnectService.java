package com.clenzy.service.paymentconnect;

import com.clenzy.model.PaymentConnection;
import com.clenzy.payment.StripeGateway;
import com.stripe.exception.StripeException;
import com.stripe.model.Account;
import com.stripe.param.AccountCreateParams;
import com.stripe.param.AccountLinkCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;
import static com.clenzy.service.paymentconnect.PaymentConnectAccess.*;

/** Shared onboarding for owners, concierge organizations and service providers. No fund movement here. */
@Service
public class PaymentConnectService {
    public enum Intent { CREATE, CONNECT }
    public record Status(Scope scope, String country, boolean accountCreated, boolean chargesEnabled,
                         boolean payoutsEnabled, boolean transfersEnabled, boolean ready,
                         boolean canManageOrganization, boolean creationAvailable, boolean connectionAvailable,
                         boolean reconnectRequired) {}
    private final PaymentConnectAccess access;
    private final PaymentConnectionStore store;
    private final StripeGateway stripe;
    private final PaymentConnectState states;
    private final String clientId;
    private final String returnBase;

    public PaymentConnectService(PaymentConnectAccess access, PaymentConnectionStore store, StripeGateway stripe,
            PaymentConnectState states, @Value("${stripe.connect.client-id:}") String clientId,
            @Value("${clenzy.base-url:https://app.clenzy.fr}") String baseUrl) {
        this.access = access;
        this.store = store;
        this.stripe = stripe;
        this.states = states;
        this.clientId = clientId;
        this.returnBase = baseUrl.replaceAll("/+$", "") + "/payment-connect/return";
    }

    public Status status(String subject, Scope scope) {
        Beneficiary b = access.resolve(subject, scope);
        PaymentConnection c = store.find(b).orElse(null);
        boolean legacy = c == null && store.legacyAccount(b).isPresent();
        return new Status(scope, c != null ? c.getCountry() : legacy ? "FR" : null,
                legacy || c != null && c.getProviderAccountId() != null,
                c != null && c.isChargesEnabled(), c != null && c.isPayoutsEnabled(),
                c != null && c.isTransfersEnabled(), c != null && c.isReady(),
                access.canManageOrganization(subject), stripe.isConfigured(),
                stripe.isConfigured() && !clientId.isBlank(), c != null && !c.isAuthorized());
    }

    public String start(String subject, Scope scope, String country, Intent intent) throws StripeException {
        Beneficiary b = access.resolve(subject, scope);
        // France is the only activated Baitly Connect entity. Currency/language never select a legal country.
        if (!"FR".equals(country)) throw new IllegalArgumentException("Regional provider partnership is not activated");
        if (!stripe.isConfigured()) throw new IllegalStateException("Stripe is not configured");
        if (intent == Intent.CONNECT && clientId.isBlank()) throw new IllegalStateException("Stripe OAuth is not configured");
        PaymentConnection c = store.prepare(b, country);
        if (intent == Intent.CONNECT || !c.isAuthorized()) {
            if (clientId.isBlank()) throw new IllegalStateException("Stripe OAuth is not configured");
            return UriComponentsBuilder.fromHttpUrl("https://connect.stripe.com/oauth/authorize")
                    .queryParam("response_type", "code").queryParam("client_id", clientId)
                    .queryParam("scope", "read_write").queryParam("state", states.create(b))
                    .queryParam("redirect_uri", returnUrl(scope, "oauth")).build().encode().toUriString();
        }
        Account account = c.getProviderAccountId() == null ? create(b, c) : stripe.retrieveAccount(c.getProviderAccountId());
        store.attach(b, account);
        // Standard account holders manage their own requirements in the official Stripe Dashboard.
        // Resume Stripe-hosted onboarding for every account, including OAuth-linked Standard accounts.
        // A generic Dashboard URL loses the beneficiary context and the return to Baitly.
        return stripe.createAccountLink(AccountLinkCreateParams.builder().setAccount(account.getId())
                .setType(AccountLinkCreateParams.Type.ACCOUNT_ONBOARDING)
                .setReturnUrl(returnUrl(scope, "return")).setRefreshUrl(returnUrl(scope, "refresh")).build()).getUrl();
    }

    private Account create(Beneficiary b, PaymentConnection c) throws StripeException {
        var params = AccountCreateParams.builder().setType(AccountCreateParams.Type.EXPRESS)
                .setCountry(c.getCountry())
                .putMetadata("baitly_connection", c.getId().toString())
                .setCapabilities(AccountCreateParams.Capabilities.builder()
                        .setTransfers(AccountCreateParams.Capabilities.Transfers.builder().setRequested(true).build())
                        .setCardPayments(AccountCreateParams.Capabilities.CardPayments.builder().setRequested(true).build()).build());
        if (b.email() != null) params.setEmail(b.email());
        return stripe.createAccount(params.build(), "baitly-connect-" + c.getId());
    }

    public Status complete(String subject, Scope scope, String state, String code) throws StripeException {
        Beneficiary b = access.resolve(subject, scope);
        states.consume(state, b);
        if (code == null || code.isBlank() || code.length() > 2048) throw new IllegalArgumentException("Authorization code missing");
        String accountId = stripe.connectExistingAccount(code);
        if (accountId == null || !accountId.startsWith("acct_")) throw new IllegalStateException("Invalid Stripe authorization response");
        store.attach(b, stripe.retrieveAccount(accountId));
        return status(subject, scope);
    }

    public Status refresh(String subject, Scope scope) throws StripeException {
        Beneficiary b = access.resolve(subject, scope);
        PaymentConnection c = store.find(b).orElse(null);
        if (c == null && store.legacyAccount(b).isPresent()) c = store.prepare(b, "FR");
        if (c != null && c.isAuthorized() && c.getProviderAccountId() != null)
            store.attach(b, stripe.retrieveAccount(c.getProviderAccountId()));
        return status(subject, scope);
    }

    private String returnUrl(Scope scope, String flow) {
        return UriComponentsBuilder.fromHttpUrl(returnBase).queryParam("scope", scope.name())
                .queryParam("flow", flow).build().toUriString();
    }
}
