package com.clenzy.service;

import com.clenzy.model.PaymentProviderType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests unitaires sur la logique de routing currency-aware ajoutee en PR5 a
 * {@link PaymentOrchestrationService#preferredProviderForCurrency(String)}.
 *
 * <h2>Strategie</h2>
 * <p>La methode est pure (aucun side effect, aucune dependance Spring) — on
 * la teste directement sans monter le contexte. Le branchement de cette
 * regle dans {@code resolveProvider} (devise reconnue + provider enabled
 * pour l'org) est valide par l'integration end-to-end en sandbox.</p>
 */
class PaymentOrchestrationServiceCurrencyTest {

    @Nested
    @DisplayName("Devises avec mapping fort vers un provider regional")
    class StrongMappings {

        @Test
        @DisplayName("SAR (riyal saoudien) → [PayTabs]")
        void sar_mapsToPaytabs() {
            assertThat(PaymentOrchestrationService.preferredProvidersForCurrency("SAR"))
                .containsExactly(PaymentProviderType.PAYTABS);
        }

        @Test
        @DisplayName("MAD (dirham marocain) → [CMI, Payzone] — CMI prefere")
        void mad_mapsToCmiThenPayzone() {
            assertThat(PaymentOrchestrationService.preferredProvidersForCurrency("MAD"))
                .containsExactly(PaymentProviderType.CMI, PaymentProviderType.PAYZONE);
        }

        @Test
        @DisplayName("Mapping insensitive a la casse")
        void caseInsensitive() {
            assertThat(PaymentOrchestrationService.preferredProvidersForCurrency("sar"))
                .containsExactly(PaymentProviderType.PAYTABS);
            assertThat(PaymentOrchestrationService.preferredProvidersForCurrency("Mad"))
                .containsExactly(PaymentProviderType.CMI, PaymentProviderType.PAYZONE);
        }

        @Test
        @DisplayName("Helper deprecie preferredProviderForCurrency renvoie le 1er de la liste")
        @SuppressWarnings("deprecation")
        void deprecatedHelper_returnsFirstOfList() {
            assertThat(PaymentOrchestrationService.preferredProviderForCurrency("MAD"))
                .isEqualTo(PaymentProviderType.CMI);
            assertThat(PaymentOrchestrationService.preferredProviderForCurrency("SAR"))
                .isEqualTo(PaymentProviderType.PAYTABS);
        }
    }

    @Nested
    @DisplayName("Devises sans preference forte (fallback country-based)")
    class NoMapping {

        @Test
        @DisplayName("EUR → liste vide (multi-pays, Stripe par defaut)")
        void eur_returnsEmpty() {
            assertThat(PaymentOrchestrationService.preferredProvidersForCurrency("EUR"))
                .isEmpty();
        }

        @Test
        @DisplayName("USD → liste vide (multi-pays, choix par-org)")
        void usd_returnsEmpty() {
            assertThat(PaymentOrchestrationService.preferredProvidersForCurrency("USD"))
                .isEmpty();
        }

        @Test
        @DisplayName("GBP → liste vide")
        void gbp_returnsEmpty() {
            assertThat(PaymentOrchestrationService.preferredProvidersForCurrency("GBP"))
                .isEmpty();
        }

        @Test
        @DisplayName("Devise inconnue (JPY) → liste vide, pas d'exception")
        void unknown_returnsEmpty() {
            assertThat(PaymentOrchestrationService.preferredProvidersForCurrency("JPY"))
                .isEmpty();
        }
    }

    @Nested
    @DisplayName("Cas degrades")
    class EdgeCases {

        @Test
        @DisplayName("null currency → liste vide sans exception")
        void nullCurrency() {
            assertThat(PaymentOrchestrationService.preferredProvidersForCurrency(null))
                .isEmpty();
        }

        @Test
        @DisplayName("Empty string → liste vide")
        void emptyCurrency() {
            assertThat(PaymentOrchestrationService.preferredProvidersForCurrency(""))
                .isEmpty();
        }

        @Test
        @DisplayName("Whitespace → liste vide (pas de trim agressif)")
        void whitespaceCurrency() {
            assertThat(PaymentOrchestrationService.preferredProvidersForCurrency("  SAR  "))
                .isEmpty();
        }
    }
}
