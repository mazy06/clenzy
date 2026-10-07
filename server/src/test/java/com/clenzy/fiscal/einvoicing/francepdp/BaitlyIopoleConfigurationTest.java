package com.clenzy.fiscal.einvoicing.francepdp;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import static org.assertj.core.api.Assertions.*;

class BaitlyIopoleConfigurationTest {
    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(BaitlyIopoleProperties.class)
    @Import({BaitlyIopoleApi.class, BaitlyIopoleTransmission.class, BaitlyIopoleInbox.class, UnconfiguredPdpTransmissionClient.class,
        FrancePdpProvider.class, FacturXCiiBuilder.class})
    static class Config {
        @org.springframework.context.annotation.Bean com.clenzy.fiscal.einvoicing.BaitlyInvoiceFiscalDocuments documents(){
            var documents=org.mockito.Mockito.mock(com.clenzy.fiscal.einvoicing.BaitlyInvoiceFiscalDocuments.class);
            org.mockito.Mockito.when(documents.preparedArtifact(org.mockito.ArgumentMatchers.any())).thenReturn(BaitlyIopoleFixture.cii().getBytes(java.nio.charset.StandardCharsets.UTF_8));return documents;
        }
        @org.springframework.context.annotation.Bean BaitlyCiiValidator validator(){return org.mockito.Mockito.mock(BaitlyCiiValidator.class);}
        @org.springframework.context.annotation.Bean BaitlyIopoleInboxStore store() {
            return new BaitlyIopoleInboxStore(null); // Aucun accès BDD pendant les contrôles de configuration.
        }
    }

    final ApplicationContextRunner context = new ApplicationContextRunner().withUserConfiguration(Config.class);

    @Test void applicationStartsWithNoCredentialsAndNoConfiguredFiscalSender() {
        context.run(c -> {
            assertThat(c).hasNotFailed();
            assertThat(c.getBean(FrancePdpProvider.class).configured()).isFalse();
            assertThat(c.getBean(BaitlyIopoleProperties.class).getEnvironment()).isEqualTo(BaitlyIopoleProperties.Environment.SANDBOX);
        });
    }

    @Test void operatorCredentialsAloneDoNotAuthorizeAnyCustomer() {
        context.withPropertyValues("baitly.einvoice.iopole.enabled=true", "baitly.einvoice.iopole.client-id=test",
            "baitly.einvoice.iopole.client-secret=test-secret").run(c ->
                assertThat(c.getBean(FrancePdpProvider.class).configured()).isFalse());
    }

    @Test void springBindsExplicitCustomerMandateAndSelectsTheIopoleClient() {
        context.withPropertyValues("baitly.einvoice.iopole.enabled=true", "baitly.einvoice.iopole.client-id=test",
            "baitly.einvoice.iopole.client-secret=test-secret",
            "baitly.einvoice.iopole.customers.2.customer-id=" + BaitlyIopoleFixture.CUSTOMER,
            "baitly.einvoice.iopole.customers.2.pull-mode-confirmed=true",
            "baitly.einvoice.iopole.customers.2.seller-tax-id=FR-TEST-SELLER").run(c -> {
                var provider = c.getBean(FrancePdpProvider.class);
                assertThat(provider.configured()).isTrue();
                assertThat(provider.supportsReconciliation()).isTrue();
                assertThat(provider.readinessIssue(BaitlyIopoleFixture.invoice())).isNull();
                var other = BaitlyIopoleFixture.invoice(); other.setOrganizationId(3L);
                assertThat(provider.readinessIssue(other)).contains("organisation");
            });
    }
}
