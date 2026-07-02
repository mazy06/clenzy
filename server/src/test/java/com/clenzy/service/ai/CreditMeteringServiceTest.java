package com.clenzy.service.ai;

import com.clenzy.model.AiCreditRateCard;
import com.clenzy.model.AiUsageLedgerEntry;
import com.clenzy.repository.AiCreditRateCardRepository;
import com.clenzy.repository.AiUsageLedgerRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Metering credits (T-06) : resolution de taux par prefix (le plus long gagne,
 * versions courantes seulement), arrondi superieur par 1k, facteur BYOK,
 * idempotence (retry → pas de double debit), modele sans taux → debit 0 (jamais
 * d'exception), cout reel separe du debit.
 */
@ExtendWith(MockitoExtension.class)
class CreditMeteringServiceTest {

    @Mock private AiCreditRateCardRepository rateCardRepository;
    @Mock private AiUsageLedgerRepository ledgerRepository;

    private static AiCreditRateCard rate(String provider, String prefix, String type,
                                         int costMicroUsd, int millicredits) {
        return new AiCreditRateCard(provider, prefix, type, costMicroUsd, millicredits, "test");
    }

    private CreditMeteringService service() {
        when(rateCardRepository.findByEffectiveToIsNull()).thenReturn(List.of(
                rate("anthropic", "claude-sonnet-4", AiCreditRateCard.TYPE_INPUT, 3000, 750),
                rate("anthropic", "claude-sonnet-4", AiCreditRateCard.TYPE_OUTPUT, 15000, 4000),
                rate("anthropic", "claude-haiku-4", AiCreditRateCard.TYPE_INPUT, 800, 200),
                rate("anthropic", "claude-haiku-4", AiCreditRateCard.TYPE_OUTPUT, 4000, 1000)));
        return new CreditMeteringService(rateCardRepository, ledgerRepository, null, null, 0.30);
    }

    private AiUsageLedgerEntry lastSaved() {
        ArgumentCaptor<AiUsageLedgerEntry> captor = ArgumentCaptor.forClass(AiUsageLedgerEntry.class);
        verify(ledgerRepository).save(captor.capture());
        return captor.getValue();
    }

    @Test
    void debit_appliesRatePerTokenType_andStoresRealCostSeparately() {
        UUID runId = UUID.randomUUID();
        // 1000 in × 750/1k + 250 out × 4000/1k = 750 + 1000 = 1750 millicredits
        service().meterLlmUsage(42L, "kc-1", runId, 3, "mono", "ASSISTANT_CHAT",
                "anthropic", "claude-sonnet-4-20250514", 1000, 250, 400, false,
                runId + ":meter:3");

        AiUsageLedgerEntry entry = lastSaved();
        assertThat(entry.getMillicredits()).isEqualTo(-1750L);
        // Cout reel : 1000×3000/1k + 250×15000/1k = 3000 + 3750 micro-USD
        assertThat(entry.getProviderCostMicroUsd()).isEqualTo(6750L);
        assertThat(entry.getEntryType()).isEqualTo(AiUsageLedgerEntry.TYPE_DEBIT);
        assertThat(entry.getCachedPromptTokens()).isEqualTo(400);
        assertThat(entry.getRunId()).isEqualTo(runId);
        assertThat(entry.getIdempotencyKey()).isEqualTo(runId + ":meter:3");
    }

    @Test
    void ceilPer1k_neverUnderBills() {
        assertThat(CreditMeteringService.ceilPer1k(1, 750)).isEqualTo(1);      // 0.75 → 1
        assertThat(CreditMeteringService.ceilPer1k(1000, 750)).isEqualTo(750);
        assertThat(CreditMeteringService.ceilPer1k(1001, 750)).isEqualTo(751); // 750.75 → 751
        assertThat(CreditMeteringService.ceilPer1k(0, 750)).isZero();
        assertThat(CreditMeteringService.ceilPer1k(500, 0)).isZero();
    }

    @Test
    void byok_appliesReducedFactor() {
        service().meterLlmUsage(42L, "kc-1", null, null, "mono", "ASSISTANT_CHAT",
                "anthropic", "claude-sonnet-4", 1000, 0, 0, true, null);

        // 750 plein tarif × 0.30 = 225
        assertThat(lastSaved().getMillicredits()).isEqualTo(-225L);
    }

    @Test
    void prefixMatch_longestWins() {
        CreditMeteringService svc = service();

        AiCreditRateCard sonnet = svc.resolveRate("anthropic", "claude-sonnet-4-20250514",
                AiCreditRateCard.TYPE_INPUT);
        AiCreditRateCard haiku = svc.resolveRate("anthropic", "claude-haiku-4-5",
                AiCreditRateCard.TYPE_INPUT);

        assertThat(sonnet.getMillicreditsPer1k()).isEqualTo(750);
        assertThat(haiku.getMillicreditsPer1k()).isEqualTo(200);
    }

    @Test
    void unknownModel_writesZeroDebit_neverThrows() {
        assertThatCode(() -> service().meterLlmUsage(42L, "kc-1", null, null, "mono",
                "ASSISTANT_CHAT", "openai", "modele-inconnu", 1000, 100, 0, false, null))
                .doesNotThrowAnyException();

        assertThat(lastSaved().getMillicredits()).isZero();
    }

    @Test
    void duplicateIdempotencyKey_isSwallowed() {
        CreditMeteringService svc = service();
        when(ledgerRepository.save(any())).thenThrow(new DataIntegrityViolationException("dup"));

        assertThatCode(() -> svc.meterLlmUsage(42L, "kc-1", UUID.randomUUID(), 1, "mono",
                "ASSISTANT_CHAT", "anthropic", "claude-sonnet-4", 100, 10, 0, false, "same-key"))
                .doesNotThrowAnyException();
    }

    @Test
    void zeroTokensOrNullOrg_isNoOp() {
        CreditMeteringService svc = new CreditMeteringService(rateCardRepository, ledgerRepository, null, null, 0.30);

        svc.meterLlmUsage(42L, "kc-1", null, null, "mono", "ASSISTANT_CHAT",
                "anthropic", "claude-sonnet-4", 0, 0, 0, false, null);
        svc.meterLlmUsage(null, "kc-1", null, null, "mono", "ASSISTANT_CHAT",
                "anthropic", "claude-sonnet-4", 100, 10, 0, false, null);

        verify(ledgerRepository, never()).save(any());
    }
}
