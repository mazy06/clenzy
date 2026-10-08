package com.clenzy.service;

import com.clenzy.fiscal.einvoicing.*;
import com.clenzy.model.*;
import com.clenzy.payment.*;
import com.clenzy.repository.CountryRepository;
import com.stripe.exception.ApiConnectionException;
import com.stripe.model.Account;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import static com.clenzy.service.BaitlyCommerceReadiness.State.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyCommerceReadinessTest {
    StripeGateway stripe = mock(StripeGateway.class);
    PaymentMethodConfigService configs = mock(PaymentMethodConfigService.class);
    PaymentProviderRegistry providers = mock(PaymentProviderRegistry.class);
    CountryRepository countries = mock(CountryRepository.class);
    EInvoicingProviderRegistry invoicing = mock(EInvoicingProviderRegistry.class);
    BaitlyCommerceReadiness service;

    @BeforeEach void setup() {
        when(configs.getConfigsForOrganization(7L)).thenReturn(List.of());
        when(providers.getAvailableProviders()).thenReturn(Set.of(PaymentProviderType.STRIPE, PaymentProviderType.YOUCAN_PAY));
        when(countries.findByCountryCode(anyString())).thenReturn(Optional.empty());
        when(invoicing.resolve(null)).thenReturn(mock(EInvoicingProvider.class));
        service = new BaitlyCommerceReadiness(stripe, new BaitlyPlatformCommerce(stripe, "", "txcd_99999999"),
                configs, providers, countries, invoicing, "txcd_10103001");
    }
    BaitlyCommerceReadiness.State state(BaitlyCommerceReadiness.Report report, String country, String key) {
        return report.countries().stream().filter(c -> c.country().equals(country)).findFirst().orElseThrow()
                .checks().stream().filter(c -> c.key().equals(key)).findFirst().orElseThrow().state();
    }
    Account account(String country) {
        var account = new Account(); account.setId("acct_test"); account.setCountry(country);
        account.setChargesEnabled(true); account.setDetailsSubmitted(true); return account;
    }
    @Test void openingSettingsDoesNotContactPspOrClaimAnAbsentKeyIsConfigured() throws Exception {
        var report = service.inspect(7L, false);
        assertThat(report.remoteVerification()).isFalse();
        assertThat(state(report, "FR", "platformKey")).isEqualTo(MISSING);
        assertThat(state(report, "FR", "sellerAccount")).isEqualTo(NOT_CHECKED);
        assertThat(report.providers()).allMatch(p -> !p.settingsPresent());
        verify(stripe, never()).retrievePlatformAccount(); verify(stripe, never()).requireSubscriptionTaxReady();
        verify(configs).getConfigsForOrganization(7L);
    }
    @Test void missingKeyDoesNotTriggerEvenRequestedRemoteCheck() throws Exception {
        service.inspect(7L, true); verify(stripe, never()).retrievePlatformAccount();
    }
    @Test void localCompaniesNeverInheritFrenchStripeReadiness() throws Exception {
        when(stripe.isConfigured()).thenReturn(true); when(stripe.retrievePlatformAccount()).thenReturn(account("FR"));
        var report = service.inspect(7L, true);
        assertThat(state(report, "FR", "sellerAccount")).isEqualTo(CONFIGURED);
        assertThat(state(report, "FR", "taxSettings")).isEqualTo(CONFIGURED);
        assertThat(state(report, "MA", "localPlatform")).isEqualTo(NOT_CONNECTED);
        assertThat(state(report, "SA", "localPlatform")).isEqualTo(NOT_CONNECTED);
        verify(stripe, times(1)).retrievePlatformAccount();
    }
    @Test void wrongCompanyDoesNotVerifyTaxesOnTheWrongAccount() throws Exception {
        when(stripe.isConfigured()).thenReturn(true); when(stripe.retrievePlatformAccount()).thenReturn(account("US"));
        var report = service.inspect(7L, true);
        assertThat(state(report, "FR", "sellerAccount")).isEqualTo(MISSING);
        assertThat(state(report, "FR", "taxSettings")).isEqualTo(NOT_CHECKED);
        verify(stripe, never()).requireSubscriptionTaxReady();
    }
    @Test void incompleteOnboardingDoesNotPassAccountCheck() throws Exception {
        when(stripe.isConfigured()).thenReturn(true); var account = account("FR"); account.setChargesEnabled(false);
        when(stripe.retrievePlatformAccount()).thenReturn(account);
        assertThat(state(service.inspect(7L, true), "FR", "sellerAccount")).isEqualTo(MISSING);
    }
    @Test void networkFailureIsUnavailableAndDoesNotLeakPspPayload() throws Exception {
        when(stripe.isConfigured()).thenReturn(true);
        when(stripe.retrievePlatformAccount()).thenThrow(new ApiConnectionException("secret account payload"));
        var report = service.inspect(7L, true);
        assertThat(state(report, "FR", "sellerAccount")).isEqualTo(UNAVAILABLE);
        assertThat(report.toString()).doesNotContain("secret account payload");
    }
    @Test void taxConfigurationAndNetworkFailureHaveDifferentStates() throws Exception {
        when(stripe.isConfigured()).thenReturn(true); when(stripe.retrievePlatformAccount()).thenReturn(account("FR"));
        doThrow(new IllegalStateException("pending")).when(stripe).requireSubscriptionTaxReady();
        assertThat(state(service.inspect(7L, true), "FR", "taxSettings")).isEqualTo(MISSING);
        doThrow(new ApiConnectionException("unavailable")).when(stripe).requireSubscriptionTaxReady();
        assertThat(state(service.inspect(7L, true), "FR", "taxSettings")).isEqualTo(UNAVAILABLE);
    }
    @Test void aStoredProviderRecordWithoutCredentialsDoesNotPass() {
        var config = new PaymentMethodConfig(); config.setId(3L); config.setProviderType(PaymentProviderType.YOUCAN_PAY);
        config.setEnabled(true); config.setConfigJson(Map.of("merchantId", "visible"));
        when(configs.getConfigsForOrganization(7L)).thenReturn(List.of(config));
        assertThat(service.inspect(7L, false).providers()).filteredOn(p -> p.provider().equals("YOUCAN_PAY"))
                .allMatch(p -> !p.settingsPresent());
        config.setApiKeyEncrypted("encrypted-secret");
        var report = service.inspect(7L, false);
        assertThat(report.providers()).filteredOn(p -> p.provider().equals("YOUCAN_PAY")).allMatch(p -> p.settingsPresent());
        assertThat(report.toString()).doesNotContain("encrypted-secret", "merchantId");
        verify(configs, never()).decryptApiKey(any());
    }
    @Test void missingProductClassificationAndMissingTransmissionAreNotExemptions() {
        var report = service.inspect(7L, false);
        assertThat(state(report, "FR", "creditTaxCode")).isEqualTo(MISSING);
        assertThat(state(report, "FR", "hardwareTaxCode")).isEqualTo(CONFIGURED);
        assertThat(state(report, "FR", "eInvoicing")).isEqualTo(MISSING);
        when(invoicing.resolve(null)).thenReturn(new NoOpEInvoicingProvider());
        assertThat(state(service.inspect(7L, false), "FR", "eInvoicing")).isEqualTo(EXEMPTION_DECLARED);
    }
}
