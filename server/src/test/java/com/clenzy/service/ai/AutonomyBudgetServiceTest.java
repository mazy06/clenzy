package com.clenzy.service.ai;

import com.clenzy.model.AiAutonomyBudget;
import com.clenzy.model.AiUsageLedgerEntry;
import com.clenzy.repository.AiAutonomyBudgetRepository;
import com.clenzy.repository.AiUsageLedgerRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Sous-budget d'autonomie premium (X4) : gate premium (activé + sous plafond),
 * comportement au plafond (pause vs notify-only), désactivation quand
 * cap=0/comportement off/config absente, et validation de la config.
 */
@ExtendWith(MockitoExtension.class)
class AutonomyBudgetServiceTest {

    @Mock private AiAutonomyBudgetRepository budgetRepository;
    @Mock private AiUsageLedgerRepository ledgerRepository;
    @Mock private com.clenzy.repository.OrganizationRepository organizationRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private AutonomyBudgetService service() {
        return new AutonomyBudgetService(budgetRepository, ledgerRepository,
                organizationRepository, objectMapper);
    }

    /** Org sans config explicite, avec le forfait donné (defauts grille §9). */
    private void orgWithForfait(String forfait) {
        com.clenzy.model.Organization org = new com.clenzy.model.Organization();
        org.setForfait(forfait);
        when(budgetRepository.findById(42L)).thenReturn(Optional.empty());
        when(organizationRepository.findById(42L)).thenReturn(Optional.of(org));
    }

    private AiAutonomyBudget budget(long cap, String onCap, String behaviors) {
        AiAutonomyBudget b = new AiAutonomyBudget(42L);
        b.setPremiumCapMillicredits(cap);
        b.setOnCapBehavior(onCap);
        b.setBehaviors(behaviors);
        return b;
    }

    @Test
    void noConfig_isDisabled_behaviorsOffByDefault() {
        // Meme avec un plafond par defaut > 0 (forfait premium), les behaviors
        // restent OFF sans config explicite → rien ne s'execute (opt-in conserve).
        orgWithForfait("premium");

        AutonomyBudgetService.Decision decision = service().evaluate(42L, "pricing_scan");

        assertThat(decision.outcome()).isEqualTo(AutonomyBudgetService.Outcome.DISABLED);
        assertThat(decision.capMillicredits()).isEqualTo(2_500_000L);
    }

    @Test
    void defaultCap_followsForfaitGrid() {
        // Grille §9 : essentiel 0 / confort 500 / premium 2 500 credits.
        orgWithForfait("confort");
        assertThat(service().getConfig(42L).getPremiumCapMillicredits()).isEqualTo(500_000L);

        orgWithForfait("premium");
        assertThat(service().getConfig(42L).getPremiumCapMillicredits()).isEqualTo(2_500_000L);

        orgWithForfait("essentiel");
        assertThat(service().getConfig(42L).getPremiumCapMillicredits()).isZero();

        // Repli essentiel (0) : forfait null ou inconnu, comme la dotation T-07.
        orgWithForfait(null);
        assertThat(service().getConfig(42L).getPremiumCapMillicredits()).isZero();
    }

    @Test
    void explicitConfig_overridesForfaitDefault() {
        AiAutonomyBudget explicit = budget(100_000L, AiAutonomyBudget.ON_CAP_NOTIFY_ONLY, "{}");
        when(budgetRepository.findById(42L)).thenReturn(Optional.of(explicit));

        assertThat(service().getConfig(42L).getPremiumCapMillicredits()).isEqualTo(100_000L);
    }

    @Test
    void capZero_isDisabled() {
        when(budgetRepository.findById(42L))
                .thenReturn(Optional.of(budget(0L, AiAutonomyBudget.ON_CAP_NOTIFY_ONLY, "{\"pricing_scan\":true}")));

        assertThat(service().evaluate(42L, "pricing_scan").outcome())
                .isEqualTo(AutonomyBudgetService.Outcome.DISABLED);
    }

    @Test
    void behaviorOff_isDisabled() {
        when(budgetRepository.findById(42L))
                .thenReturn(Optional.of(budget(500_000L, AiAutonomyBudget.ON_CAP_NOTIFY_ONLY, "{\"pricing_scan\":false}")));

        assertThat(service().evaluate(42L, "pricing_scan").outcome())
                .isEqualTo(AutonomyBudgetService.Outcome.DISABLED);
    }

    @Test
    void underCap_isAllowed() {
        when(budgetRepository.findById(42L))
                .thenReturn(Optional.of(budget(500_000L, AiAutonomyBudget.ON_CAP_PAUSE, "{\"pricing_scan\":true}")));
        when(ledgerRepository.sumBucketDebitSince(eq(42L),
                eq(AiUsageLedgerEntry.BUCKET_PREMIUM_AUTO), any())).thenReturn(120_000L);

        assertThat(service().evaluate(42L, "pricing_scan").allowed()).isTrue();
    }

    @Test
    void atCap_pauseBehavior() {
        when(budgetRepository.findById(42L))
                .thenReturn(Optional.of(budget(500_000L, AiAutonomyBudget.ON_CAP_PAUSE, "{\"pricing_scan\":true}")));
        when(ledgerRepository.sumBucketDebitSince(eq(42L),
                eq(AiUsageLedgerEntry.BUCKET_PREMIUM_AUTO), any())).thenReturn(500_000L);

        assertThat(service().evaluate(42L, "pricing_scan").outcome())
                .isEqualTo(AutonomyBudgetService.Outcome.CAPPED_PAUSE);
    }

    @Test
    void overCap_notifyOnlyBehavior() {
        when(budgetRepository.findById(42L))
                .thenReturn(Optional.of(budget(500_000L, AiAutonomyBudget.ON_CAP_NOTIFY_ONLY, "{\"pricing_scan\":true}")));
        when(ledgerRepository.sumBucketDebitSince(eq(42L),
                eq(AiUsageLedgerEntry.BUCKET_PREMIUM_AUTO), any())).thenReturn(600_000L);

        assertThat(service().evaluate(42L, "pricing_scan").outcome())
                .isEqualTo(AutonomyBudgetService.Outcome.CAPPED_NOTIFY_ONLY);
    }

    @Test
    void updateConfig_rejectsNegativeCap() {
        assertThatThrownBy(() -> service().updateConfig(42L, -1L,
                AiAutonomyBudget.ON_CAP_PAUSE, "{}", "kc-admin"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updateConfig_rejectsInvalidBehaviorsJson() {
        assertThatThrownBy(() -> service().updateConfig(42L, 100_000L,
                AiAutonomyBudget.ON_CAP_PAUSE, "not-json", "kc-admin"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updateConfig_persistsValidConfig() {
        lenient().when(budgetRepository.findById(42L)).thenReturn(Optional.empty());
        when(budgetRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AiAutonomyBudget saved = service().updateConfig(42L, 500_000L,
                AiAutonomyBudget.ON_CAP_NOTIFY_ONLY, "{\"pricing_scan\":true}", "kc-admin");

        assertThat(saved.getPremiumCapMillicredits()).isEqualTo(500_000L);
        assertThat(saved.getOnCapBehavior()).isEqualTo(AiAutonomyBudget.ON_CAP_NOTIFY_ONLY);
        assertThat(saved.getUpdatedBy()).isEqualTo("kc-admin");
    }
}
