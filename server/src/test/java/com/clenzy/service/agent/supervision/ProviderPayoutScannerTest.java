package com.clenzy.service.agent.supervision;

import com.clenzy.model.*;
import com.clenzy.repository.HousekeeperPayoutRecordRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.service.payout.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** La constellation suit le même bénéficiaire figé que le circuit de versement Baitly. */
class ProviderPayoutScannerTest {
    private final HousekeeperPayoutRecordRepository records = mock(HousekeeperPayoutRecordRepository.class);
    private final InterventionRepository missions = mock(InterventionRepository.class);
    private final ProviderPayoutAccountResolver accounts = mock(ProviderPayoutAccountResolver.class);
    private final ProviderPayoutBeneficiaryService beneficiaries = mock(ProviderPayoutBeneficiaryService.class);
    private final HousekeeperPayoutService payouts = mock(HousekeeperPayoutService.class);
    private final SupervisionSuggestionService suggestions = mock(SupervisionSuggestionService.class);
    private final CleaningPayoutScanner scanner = new CleaningPayoutScanner(records, missions, accounts, beneficiaries, payouts, suggestions);
    private final Intervention mission = new Intervention();
    private final HousekeeperPayoutRecord record = new HousekeeperPayoutRecord(7L, null, 11L,
            BigDecimal.ZERO, BigDecimal.ZERO, HousekeeperPayoutRecord.Status.BLOCKED);
    private final HousekeeperPayoutConfig account = new HousekeeperPayoutConfig();

    @BeforeEach void setup() {
        var property = new Property(); property.setId(20L);
        mission.setId(11L); mission.setOrganizationId(7L); mission.setProperty(property);
        mission.setType("MAINTENANCE"); mission.setActualCost(BigDecimal.valueOf(100));
        mission.setStatus(InterventionStatus.COMPLETED); mission.setPaymentStatus(PaymentStatus.PAID);
        record.setId(3L); record.setBeneficiaryOrganizationId(9L);
        record.setFailureReason(HousekeeperPayoutRecord.REASON_ONBOARDING_INCOMPLETE);
        account.setStripeAccountId("acct_company"); account.setOnboardingCompleted(true);
        when(records.findByOrganizationIdAndStatusInOrderByCreatedAtDesc(eq(7L), any())).thenReturn(List.of(record));
        when(missions.findById(11L)).thenReturn(Optional.of(mission));
        when(beneficiaries.resolve(11L,7L)).thenReturn(Optional.of(new ProviderPayoutBeneficiaryService.Recipient(PayoutBeneficiary.organization(9L),null)));
        when(payouts.isProofComplete(mission)).thenReturn(true);
        when(accounts.resolve(eq(mission),any())).thenReturn(Optional.of(account));
    }
    @Test void companyTeamWithoutAssignedUserGetsAProviderRetryCard() {
        scanner.scanProperty(7L,20L);
        verify(accounts).resolve(mission,PayoutBeneficiary.organization(9L));
        verify(suggestions).recordActionable(eq(7L),eq(20L),eq("ops"),eq("Versement prestataire à débloquer (mission #11)"),
                contains("organisation prestataire #9"),eq(SupervisionActionType.CLEANING_PAYOUT),eq("{\"recordId\":3}"),eq(10000L),eq("info"));
    }
    @Test void personalTeamUsesItsFrozenIndividualBeneficiary() {
        record.setBeneficiaryOrganizationId(null); record.setUserId(42L);
        when(beneficiaries.resolve(11L,7L)).thenReturn(Optional.of(new ProviderPayoutBeneficiaryService.Recipient(PayoutBeneficiary.user(42L),"pro")));
        scanner.scanProperty(7L,20L);
        verify(accounts).resolve(mission,PayoutBeneficiary.user(42L));
        verify(suggestions).recordActionable(eq(7L),eq(20L),eq("ops"),anyString(),contains("prestataire désigné"),anyString(),anyString(),anyLong(),anyString());
    }
    @Test void changedBeneficiaryIsNeverProposedForRetry() {
        when(beneficiaries.resolve(11L,7L)).thenReturn(Optional.of(new ProviderPayoutBeneficiaryService.Recipient(PayoutBeneficiary.user(42L),"pro")));
        scanner.scanProperty(7L,20L);
        verifyNoInteractions(accounts,suggestions);
    }
    @Test void uncertainTransferDoesNotBecomeARetryCard() {
        record.setFailureReason("RECONCILIATION_REQUIRED");
        scanner.scanProperty(7L,20L);
        verifyNoInteractions(accounts,suggestions);
    }
    @Test void unavailableCompanyAccountDoesNotFallBackToAnEmployee() {
        account.setOnboardingCompleted(false);
        scanner.scanProperty(7L,20L);
        verifyNoInteractions(suggestions);
    }
    @Test void wrongOrganizationCannotSeeOrProposeTheMission() {
        mission.setOrganizationId(8L);
        scanner.scanProperty(7L,20L);
        verifyNoInteractions(beneficiaries,accounts,suggestions);
    }
    @Test void missionNoLongerPaidCannotBeProposedForRetry() {
        mission.setPaymentStatus(PaymentStatus.REFUNDED);
        scanner.scanProperty(7L,20L);
        verifyNoInteractions(beneficiaries,accounts,suggestions);
    }
}
