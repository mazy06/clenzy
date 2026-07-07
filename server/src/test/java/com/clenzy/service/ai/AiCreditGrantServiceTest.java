package com.clenzy.service.ai;

import com.clenzy.model.AiCreditGrant;
import com.clenzy.model.AiUsageLedgerEntry;
import com.clenzy.model.User;
import com.clenzy.repository.AiCreditGrantRepository;
import com.clenzy.repository.AiUsageLedgerRepository;
import com.clenzy.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Dotations de credits (T-07) : idempotence par stripeRef (retry webhook sans
 * double credit), mapping forfait → dotation, ligne GRANT au ledger +
 * invalidation du solde chaud, expiration journalisee en EXPIRY puis poche
 * soldee.
 */
@ExtendWith(MockitoExtension.class)
class AiCreditGrantServiceTest {

    private static final long ESSENTIEL = 500_000L;
    private static final long CONFORT = 2_000_000L;
    private static final long PREMIUM = 8_000_000L;

    @Mock private AiCreditGrantRepository grantRepository;
    @Mock private AiUsageLedgerRepository ledgerRepository;
    @Mock private CreditBalanceService balanceService;
    @Mock private UserRepository userRepository;
    @Mock private com.clenzy.repository.OrganizationRepository organizationRepository;

    private AiCreditGrantService service() {
        return new AiCreditGrantService(grantRepository, ledgerRepository, balanceService,
                userRepository, organizationRepository, ESSENTIEL, CONFORT, PREMIUM);
    }

    private static User payer(Long orgId, String forfait) {
        User user = new User();
        user.setOrganizationId(orgId);
        user.setForfait(forfait);
        return user;
    }

    @Test
    void paidInvoice_grantsAllotmentMatchingForfait() {
        when(userRepository.findByStripeSubscriptionId("sub_1"))
                .thenReturn(Optional.of(payer(42L, "premium")));
        when(grantRepository.existsByStripeRef("in_1")).thenReturn(false);
        when(ledgerRepository.existsByIdempotencyKey("grant:in_1")).thenReturn(false);

        service().grantForPaidInvoice("sub_1", "in_1");

        ArgumentCaptor<AiCreditGrant> captor = ArgumentCaptor.forClass(AiCreditGrant.class);
        verify(grantRepository).save(captor.capture());
        AiCreditGrant grant = captor.getValue();
        assertThat(grant.getSource()).isEqualTo(AiCreditGrant.SOURCE_SUBSCRIPTION);
        assertThat(grant.getMillicreditsGranted()).isEqualTo(PREMIUM);
        assertThat(grant.getOrganizationId()).isEqualTo(42L);
        assertThat(grant.getStripeRef()).isEqualTo("in_1");
        // Ligne GRANT positive au ledger + invalidation du solde chaud.
        ArgumentCaptor<AiUsageLedgerEntry> ledger = ArgumentCaptor.forClass(AiUsageLedgerEntry.class);
        verify(ledgerRepository).save(ledger.capture());
        assertThat(ledger.getValue().getEntryType()).isEqualTo(AiUsageLedgerEntry.TYPE_GRANT);
        assertThat(ledger.getValue().getMillicredits()).isEqualTo(PREMIUM);
        verify(balanceService).invalidate(42L);
    }

    @Test
    void unknownSubscription_isSilentlyIgnored() {
        when(userRepository.findByStripeSubscriptionId("sub_x")).thenReturn(Optional.empty());

        service().grantForPaidInvoice("sub_x", "in_x");

        verify(grantRepository, never()).save(any());
    }

    @Test
    void duplicateStripeRef_doesNotDoubleGrant() {
        when(grantRepository.existsByStripeRef("cs_1")).thenReturn(true);

        service().grantTopUp(42L, 500_000L, "cs_1");

        verify(grantRepository, never()).save(any());
        verify(ledgerRepository, never()).save(any());
    }

    @Test
    void topUp_grantsTopUpPocket() {
        when(grantRepository.existsByStripeRef("cs_2")).thenReturn(false);
        when(ledgerRepository.existsByIdempotencyKey(anyString())).thenReturn(false);

        service().grantTopUp(42L, 2_000_000L, "cs_2");

        ArgumentCaptor<AiCreditGrant> captor = ArgumentCaptor.forClass(AiCreditGrant.class);
        verify(grantRepository).save(captor.capture());
        assertThat(captor.getValue().getSource()).isEqualTo(AiCreditGrant.SOURCE_TOPUP);
        assertThat(captor.getValue().getMillicreditsGranted()).isEqualTo(2_000_000L);
        verify(balanceService).invalidate(42L);
    }

    @Test
    void expiry_writesExpiryLine_andSettlesPocket() {
        AiCreditGrant stale = new AiCreditGrant(42L, AiCreditGrant.SOURCE_SUBSCRIPTION,
                1000L, Instant.now().minusSeconds(60), "in_old");
        stale.applyConsumption(400L); // restant = 600
        when(grantRepository.findExpiredWithRemaining(any())).thenReturn(List.of(stale));
        when(ledgerRepository.existsByIdempotencyKey(anyString())).thenReturn(false);

        int expired = service().expireOverdueGrants();

        assertThat(expired).isEqualTo(1);
        assertThat(stale.remaining()).isZero(); // soldee → jamais re-expiree
        ArgumentCaptor<AiUsageLedgerEntry> ledger = ArgumentCaptor.forClass(AiUsageLedgerEntry.class);
        verify(ledgerRepository).save(ledger.capture());
        assertThat(ledger.getValue().getEntryType()).isEqualTo(AiUsageLedgerEntry.TYPE_EXPIRY);
        assertThat(ledger.getValue().getMillicredits()).isEqualTo(-600L);
        verify(balanceService).invalidate(42L);
    }

    private static User prepaidPayer(Long orgId, String forfait, String billingPeriod) {
        User user = payer(orgId, forfait);
        user.setStripeSubscriptionId("sub_" + orgId);
        user.setBillingPeriod(billingPeriod);
        return user;
    }

    @Test
    void monthlyRefresh_grantsPrepaidSubscriber_notYetRefreshedThisMonth() {
        when(userRepository.findByStripeSubscriptionIdIsNotNullAndBillingPeriodIn(any()))
                .thenReturn(List.of(prepaidPayer(7L, "confort", "ANNUAL")));
        when(grantRepository.existsByOrganizationIdAndSourceAndGrantedAtGreaterThanEqual(
                eq(7L), eq(AiCreditGrant.SOURCE_SUBSCRIPTION), any())).thenReturn(false);
        when(grantRepository.existsByStripeRef(anyString())).thenReturn(false);
        when(ledgerRepository.existsByIdempotencyKey(anyString())).thenReturn(false);

        int refreshed = service().refreshMonthlyForPrepaidSubscribers();

        assertThat(refreshed).isEqualTo(1);
        ArgumentCaptor<AiCreditGrant> captor = ArgumentCaptor.forClass(AiCreditGrant.class);
        verify(grantRepository).save(captor.capture());
        assertThat(captor.getValue().getSource()).isEqualTo(AiCreditGrant.SOURCE_SUBSCRIPTION);
        assertThat(captor.getValue().getMillicreditsGranted()).isEqualTo(CONFORT);
        assertThat(captor.getValue().getOrganizationId()).isEqualTo(7L);
    }

    @Test
    void monthlyRefresh_skipsOrgAlreadyRefreshedThisMonth() {
        // invoice de renouvellement déjà tombé ce mois → pas de double crédit.
        when(userRepository.findByStripeSubscriptionIdIsNotNullAndBillingPeriodIn(any()))
                .thenReturn(List.of(prepaidPayer(7L, "premium", "BIENNIAL")));
        when(grantRepository.existsByOrganizationIdAndSourceAndGrantedAtGreaterThanEqual(
                eq(7L), eq(AiCreditGrant.SOURCE_SUBSCRIPTION), any())).thenReturn(true);

        int refreshed = service().refreshMonthlyForPrepaidSubscribers();

        assertThat(refreshed).isZero();
        verify(grantRepository, never()).save(any());
    }

    @Test
    void ledgerLineAlreadyWritten_isNotDuplicated() {
        when(grantRepository.existsByStripeRef("cs_3")).thenReturn(false);
        when(ledgerRepository.existsByIdempotencyKey("grant:cs_3")).thenReturn(true);

        service().grantTopUp(42L, 500_000L, "cs_3");

        verify(grantRepository).save(any());          // la poche est creee
        verify(ledgerRepository, never()).save(any()); // mais pas de 2e ligne GRANT
    }
}
