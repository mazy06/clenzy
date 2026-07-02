package com.clenzy.service.ai;

import com.clenzy.model.AiUsageLedgerEntry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Harnais des runs autonomes (X8) : le bucket est posé pendant le run et
 * TOUJOURS nettoyé après (pas de fuite sur un run interactif ultérieur), et le
 * gate premium empêche l'exécution quand le plafond est atteint.
 */
@ExtendWith(MockitoExtension.class)
class AutonomyRunScopeTest {

    @Mock private AutonomyBudgetService budgetService;

    private final AutonomyContextHolder holder = new AutonomyContextHolder();

    private AutonomyRunScope scope() {
        return new AutonomyRunScope(holder, budgetService);
    }

    @Test
    void runSocle_setsSocleBucketDuringRun_thenClears() {
        String[] seen = {null};
        scope().runSocle(() -> seen[0] = holder.current());

        assertThat(seen[0]).isEqualTo(AiUsageLedgerEntry.BUCKET_SOCLE);
        // Nettoye : retour au defaut interactif.
        assertThat(holder.current()).isEqualTo(AiUsageLedgerEntry.BUCKET_INTERACTIVE);
    }

    @Test
    void runSocle_clearsBucket_evenOnException() {
        try {
            scope().runSocle(() -> { throw new RuntimeException("boom"); });
        } catch (RuntimeException ignored) {
            // attendu
        }
        assertThat(holder.current()).isEqualTo(AiUsageLedgerEntry.BUCKET_INTERACTIVE);
    }

    @Test
    void runPremium_allowed_runsWithPremiumBucket() {
        when(budgetService.evaluate(42L, "pricing_scan"))
                .thenReturn(new AutonomyBudgetService.Decision(
                        AutonomyBudgetService.Outcome.ALLOWED, 500_000L, 100_000L));
        String[] seen = {null};

        AutonomyBudgetService.Decision decision =
                scope().runPremium(42L, "pricing_scan", () -> seen[0] = holder.current());

        assertThat(decision.allowed()).isTrue();
        assertThat(seen[0]).isEqualTo(AiUsageLedgerEntry.BUCKET_PREMIUM_AUTO);
        assertThat(holder.current()).isEqualTo(AiUsageLedgerEntry.BUCKET_INTERACTIVE);
    }

    @Test
    void runPremium_capped_doesNotRun() {
        when(budgetService.evaluate(42L, "pricing_scan"))
                .thenReturn(new AutonomyBudgetService.Decision(
                        AutonomyBudgetService.Outcome.CAPPED_PAUSE, 500_000L, 500_000L));
        boolean[] ran = {false};

        AutonomyBudgetService.Decision decision =
                scope().runPremium(42L, "pricing_scan", () -> ran[0] = true);

        assertThat(ran[0]).isFalse();
        assertThat(decision.outcome()).isEqualTo(AutonomyBudgetService.Outcome.CAPPED_PAUSE);
    }
}
