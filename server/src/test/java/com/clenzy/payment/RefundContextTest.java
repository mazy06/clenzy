package com.clenzy.payment;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests unitaires pour {@link RefundContext}.
 *
 * <p>Le compact constructor valide les invariants ; on s'assure qu'un
 * RefundContext incomplet est rejeté à la construction plutôt que de
 * causer un NullPointerException plus tard dans le code provider.</p>
 */
class RefundContextTest {

    @Test
    @DisplayName("Construction réussie avec tous les champs valides")
    void validConstruction() {
        var ctx = new RefundContext(
            42L, "TX-PROVIDER-001", "TX-CLENZY-001",
            "EUR", new BigDecimal("100"));
        assertThat(ctx.orgId()).isEqualTo(42L);
        assertThat(ctx.providerTxId()).isEqualTo("TX-PROVIDER-001");
        assertThat(ctx.originalTransactionRef()).isEqualTo("TX-CLENZY-001");
        assertThat(ctx.currency()).isEqualTo("EUR");
        assertThat(ctx.originalAmount()).isEqualByComparingTo("100");
    }

    @Test
    @DisplayName("originalAmount et originalTransactionRef peuvent être null (refund partiel)")
    void nullableFields_areAccepted() {
        var ctx = new RefundContext(1L, "TX-001", null, "EUR", null);
        assertThat(ctx.originalTransactionRef()).isNull();
        assertThat(ctx.originalAmount()).isNull();
    }

    @Test
    @DisplayName("orgId null est rejeté")
    void nullOrgId_throws() {
        assertThatThrownBy(() -> new RefundContext(null, "TX-001", "TX-1", "EUR", BigDecimal.ONE))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("orgId");
    }

    @Test
    @DisplayName("providerTxId null est rejeté")
    void nullProviderTxId_throws() {
        assertThatThrownBy(() -> new RefundContext(1L, null, "TX-1", "EUR", BigDecimal.ONE))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("providerTxId");
    }

    @Test
    @DisplayName("providerTxId vide est rejeté")
    void blankProviderTxId_throws() {
        assertThatThrownBy(() -> new RefundContext(1L, "  ", "TX-1", "EUR", BigDecimal.ONE))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("providerTxId");
    }

    @Test
    @DisplayName("currency null est rejeté")
    void nullCurrency_throws() {
        assertThatThrownBy(() -> new RefundContext(1L, "TX-001", "TX-1", null, BigDecimal.ONE))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("currency");
    }

    @Test
    @DisplayName("currency vide est rejetée")
    void blankCurrency_throws() {
        assertThatThrownBy(() -> new RefundContext(1L, "TX-001", "TX-1", "", BigDecimal.ONE))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("currency");
    }
}
