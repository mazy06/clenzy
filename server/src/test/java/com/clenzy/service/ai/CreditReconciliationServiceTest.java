package com.clenzy.service.ai;

import com.clenzy.repository.AiCreditGrantRepository;
import com.clenzy.repository.AiTokenUsageRepository;
import com.clenzy.repository.AiUsageLedgerRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.YearMonth;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Reconciliation double (X10) : derive du solde chaud corrigee (invalidate +
 * compteur) au-dela de la tolerance, tolerance respectee (reservations en vol),
 * cache froid ignore, et rapport mensuel structure (marge/revenu/cross-check).
 */
@ExtendWith(MockitoExtension.class)
class CreditReconciliationServiceTest {

    @Mock private AiUsageLedgerRepository ledgerRepository;
    @Mock private AiCreditGrantRepository grantRepository;
    @Mock private AiTokenUsageRepository tokenUsageRepository;
    @Mock private CreditBalanceService balanceService;

    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();

    private CreditReconciliationService service() {
        return new CreditReconciliationService(ledgerRepository, grantRepository,
                tokenUsageRepository, balanceService, registry);
    }

    @Test
    void hotBalanceDrift_beyondTolerance_isCorrected() {
        when(grantRepository.findOrganizationsWithActiveGrants(any())).thenReturn(List.of(42L));
        when(balanceService.readHotBalance(42L)).thenReturn(10_000L);
        when(balanceService.coldBalance(42L)).thenReturn(15_000L); // delta 5000 > tolerance 1000

        int drifts = service().reconcileHotBalances();

        assertThat(drifts).isEqualTo(1);
        verify(balanceService).invalidate(42L);
        assertThat(registry.find(CreditReconciliationService.DRIFT_COUNTER).counter().count())
                .isEqualTo(1d);
    }

    @Test
    void smallDrift_withinTolerance_isLeftAlone() {
        // Une reservation en vol de moins d'1 credit n'est PAS une derive.
        when(grantRepository.findOrganizationsWithActiveGrants(any())).thenReturn(List.of(42L));
        when(balanceService.readHotBalance(42L)).thenReturn(14_500L);
        when(balanceService.coldBalance(42L)).thenReturn(15_000L);

        assertThat(service().reconcileHotBalances()).isZero();
        verify(balanceService, never()).invalidate(any());
    }

    @Test
    void coldCache_isSkipped() {
        when(grantRepository.findOrganizationsWithActiveGrants(any())).thenReturn(List.of(42L));
        when(balanceService.readHotBalance(42L)).thenReturn(null);

        assertThat(service().reconcileHotBalances()).isZero();
        verify(balanceService, never()).coldBalance(any());
    }

    @Test
    void monthlyReport_aggregatesMarginRevenueAndCrossCheck() {
        YearMonth month = YearMonth.of(2026, 6);
        when(ledgerRepository.aggregateUsageByProvider(any(), any())).thenReturn(List.<Object[]>of(
                new Object[]{"anthropic", 125_000L, 600_000L, 2_000_000L}));
        when(tokenUsageRepository.sumTokensByProviderForMonth("2026-06")).thenReturn(List.<Object[]>of(
                new Object[]{"anthropic", 2_100_000L})); // divergence 4.8% < 5% : pas d'alerte
        when(grantRepository.sumGrantedBySource(any(), any())).thenReturn(List.<Object[]>of(
                new Object[]{"SUBSCRIPTION", 8_000_000L, 4L},
                new Object[]{"TOPUP", 2_000_000L, 1L}));

        Map<String, Object> report = service().monthlyReport(month);

        assertThat(report.get("month")).isEqualTo("2026-06");
        @SuppressWarnings("unchecked")
        var providers = (List<Map<String, Object>>) report.get("providers");
        assertThat(providers).hasSize(1);
        assertThat(providers.get(0).get("realCostMicroUsd")).isEqualTo(125_000L);
        assertThat(providers.get(0).get("clientDebitMillicredits")).isEqualTo(600_000L);
        @SuppressWarnings("unchecked")
        var grants = (List<Map<String, Object>>) report.get("grantsBySource");
        assertThat(grants).hasSize(2);
        @SuppressWarnings("unchecked")
        var crossCheck = (List<Map<String, Object>>) report.get("tokenCrossCheck");
        assertThat(crossCheck.get(0).get("divergencePct")).isEqualTo(4.8);
    }
}
