package com.clenzy.payment.payout;

import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests unitaires pour {@link PayoutExecutorRegistry}.
 *
 * <h2>Stratégie</h2>
 * <p>On construit le registry avec des stubs d'exécuteurs pour valider la
 * découverte par méthode + la détection de conflits (deux exécuteurs pour
 * la même méthode).</p>
 */
class PayoutExecutorRegistryTest {

    @Test
    @DisplayName("Le registry indexe les exécuteurs par méthode")
    void registry_indexesByMethod() {
        var stripe = new StubExecutor(PayoutMethod.STRIPE_CONNECT);
        var sepa = new StubExecutor(PayoutMethod.SEPA_TRANSFER);
        var registry = new PayoutExecutorRegistry(List.of(stripe, sepa));

        assertThat(registry.get(PayoutMethod.STRIPE_CONNECT)).isSameAs(stripe);
        assertThat(registry.get(PayoutMethod.SEPA_TRANSFER)).isSameAs(sepa);
        assertThat(registry.getSupportedMethods())
            .containsExactlyInAnyOrder(PayoutMethod.STRIPE_CONNECT, PayoutMethod.SEPA_TRANSFER);
    }

    @Test
    @DisplayName("Get sur méthode non enregistrée lève une PayoutExecutionException")
    void get_unknownMethod_throws() {
        var registry = new PayoutExecutorRegistry(List.of(new StubExecutor(PayoutMethod.STRIPE_CONNECT)));
        assertThatThrownBy(() -> registry.get(PayoutMethod.WISE))
            .isInstanceOf(PayoutExecutor.PayoutExecutionException.class)
            .hasMessageContaining("WISE");
    }

    @Test
    @DisplayName("Conflit : deux exécuteurs pour la même méthode → IllegalStateException")
    void registry_rejectsDuplicates() {
        var a = new StubExecutor(PayoutMethod.STRIPE_CONNECT);
        var b = new StubExecutor(PayoutMethod.STRIPE_CONNECT);
        assertThatThrownBy(() -> new PayoutExecutorRegistry(List.of(a, b)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("STRIPE_CONNECT");
    }

    @Test
    @DisplayName("Registry vide est valide (aucune méthode supportée)")
    void registry_empty_isValid() {
        var registry = new PayoutExecutorRegistry(List.of());
        assertThat(registry.getSupportedMethods()).isEmpty();
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    static class StubExecutor implements PayoutExecutor {
        private final PayoutMethod method;
        StubExecutor(PayoutMethod method) { this.method = method; }
        @Override public PayoutMethod getSupportedMethod() { return method; }
        @Override
        public OwnerPayout execute(OwnerPayout payout, OwnerPayoutConfig config) {
            return payout;
        }
    }
}
