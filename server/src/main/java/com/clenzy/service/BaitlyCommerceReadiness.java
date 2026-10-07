package com.clenzy.service;

import com.clenzy.fiscal.einvoicing.EInvoicingMode;
import com.clenzy.fiscal.einvoicing.EInvoicingProviderRegistry;
import com.clenzy.model.PaymentMethodConfig;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.payment.PaymentProviderRegistry;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.CountryRepository;
import com.stripe.exception.StripeException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Diagnostic technique en lecture seule. Ne certifie ni la conformité ni la recette des paiements. */
@Service
public class BaitlyCommerceReadiness {
    public enum State { CONFIGURED, MISSING, NOT_CHECKED, UNAVAILABLE, NOT_CONNECTED, EXEMPTION_DECLARED }
    public record Check(String key, State state) {}
    public record CountryChecks(String country, List<Check> checks) {}
    public record ProviderChecks(String provider, boolean settingsPresent, boolean implemented) {}
    public record Report(Instant checkedAt, boolean remoteVerification, List<CountryChecks> countries,
                         List<ProviderChecks> providers) {}

    private final StripeGateway stripe;
    private final BaitlyPlatformCommerce commerce;
    private final PaymentMethodConfigService configs;
    private final PaymentProviderRegistry providers;
    private final CountryRepository countries;
    private final EInvoicingProviderRegistry invoicing;
    private final String saasTaxCode;

    public BaitlyCommerceReadiness(StripeGateway stripe, BaitlyPlatformCommerce commerce,
            PaymentMethodConfigService configs, PaymentProviderRegistry providers,
            CountryRepository countries, EInvoicingProviderRegistry invoicing,
            @Value("${stripe.tax.saas-product-tax-code:txcd_10103001}") String saasTaxCode) {
        this.stripe = stripe; this.commerce = commerce; this.configs = configs;
        this.providers = providers; this.countries = countries; this.invoicing = invoicing;
        this.saasTaxCode = saasTaxCode;
    }

    // Les GET du PSP doivent rester hors transaction et ne sont jamais déclenchés au simple affichage.
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public Report inspect(Long organizationId, boolean verify) {
        var stored = configs.getConfigsForOrganization(organizationId);
        var providerChecks = providers.getAvailableProviders().stream().sorted()
                .map(type -> new ProviderChecks(type.name(), settingsPresent(type, stored), true)).toList();
        var result = new ArrayList<CountryChecks>();
        for (String country : List.of("FR", "MA", "SA")) {
            var checks = new ArrayList<Check>();
            if (country.equals("FR")) {
                checks.add(new Check("platformKey", state(stripe.isConfigured())));
                checks.addAll(remoteChecks(verify));
            } else {
                // Les adaptateurs d'encaissement locaux ne constituent pas un circuit Connect/abonnement.
                checks.add(new Check("localPlatform", State.NOT_CONNECTED));
            }
            checks.add(new Check("pmsTaxCode", state(validTaxCode(saasTaxCode))));
            checks.add(new Check("creditTaxCode", state(commerce.taxCodeConfigured("AI_CREDIT_TOPUP"))));
            checks.add(new Check("hardwareTaxCode", state(commerce.taxCodeConfigured("HARDWARE_ORDER"))));
            var adapter = invoicing.resolve(countries.findByCountryCode(country).orElse(null));
            checks.add(new Check("eInvoicing", !adapter.configured() ? State.MISSING
                    : adapter.mode() == EInvoicingMode.NONE ? State.EXEMPTION_DECLARED : State.CONFIGURED));
            result.add(new CountryChecks(country, List.copyOf(checks)));
        }
        return new Report(Instant.now(), verify, List.copyOf(result), providerChecks);
    }

    private List<Check> remoteChecks(boolean verify) {
        State seller = State.NOT_CHECKED;
        State tax = State.NOT_CHECKED;
        if (verify && stripe.isConfigured()) {
            try {
                var account = stripe.retrievePlatformAccount();
                seller = state(account != null && "FR".equalsIgnoreCase(account.getCountry())
                        && Boolean.TRUE.equals(account.getDetailsSubmitted())
                        && Boolean.TRUE.equals(account.getChargesEnabled()));
                // Ne jamais déclarer la taxe française prête à partir du compte d'une autre société.
                if (seller == State.CONFIGURED) {
                    try { stripe.requireSubscriptionTaxReady(); tax = State.CONFIGURED; }
                    catch (IllegalStateException e) { tax = State.MISSING; }
                    catch (StripeException e) { tax = State.UNAVAILABLE; }
                }
            } catch (StripeException e) { seller = State.UNAVAILABLE; }
        }
        return List.of(new Check("sellerAccount", seller), new Check("taxSettings", tax));
    }

    private boolean settingsPresent(PaymentProviderType type, List<PaymentMethodConfig> stored) {
        if (type == PaymentProviderType.STRIPE) return stripe.isConfigured();
        var config = stored.stream().filter(c -> c.getProviderType() == type).findFirst().orElse(null);
        if (config == null || !present(config.getApiKeyEncrypted())) return false;
        Map<String, Object> json = config.getConfigJson() == null ? Map.of() : config.getConfigJson();
        return switch (type) {
            case CMI -> present(config.getApiSecretEncrypted()) && text(json, "okUrl") && text(json, "failUrl");
            case PAYTABS -> json.get("profileId") instanceof Number n && n.longValue() > 0 && text(json, "region");
            case PAYZONE, YOUCAN_PAY -> true;
            default -> false;
        };
    }

    private static boolean text(Map<String, Object> json, String key) { return json.get(key) instanceof String s && present(s); }
    private static boolean present(String value) { return value != null && !value.isBlank(); }
    private static boolean validTaxCode(String value) { return value != null && value.matches("txcd_[0-9]{8}"); }
    private static State state(boolean configured) { return configured ? State.CONFIGURED : State.MISSING; }
}
