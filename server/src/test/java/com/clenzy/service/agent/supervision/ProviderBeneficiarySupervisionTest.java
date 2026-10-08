package com.clenzy.service.agent.supervision;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.payout.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;

import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProviderBeneficiarySupervisionTest {
    final InterventionRepository interventions = mock(InterventionRepository.class);
    final ProviderPayoutBeneficiaryService beneficiaries = mock(ProviderPayoutBeneficiaryService.class);
    final HousekeeperPayoutService payouts = mock(HousekeeperPayoutService.class);
    final SupervisionSuggestionService suggestions = mock(SupervisionSuggestionService.class);
    final SupervisionSuggestionRepository cards = mock(SupervisionSuggestionRepository.class);
    final SupervisionRealtimePublisher realtime = mock(SupervisionRealtimePublisher.class);
    final PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
    final ObjectMapper mapper = new ObjectMapper();
    final Clock clock = Clock.fixed(Instant.parse("2026-10-08T10:00:00Z"), ZoneOffset.UTC);
    final ProviderBeneficiarySupervision service = new ProviderBeneficiarySupervision(interventions, beneficiaries,
            payouts, suggestions, cards, realtime, mapper, clock, transactions);
    final ProviderPayoutBeneficiaryService.Review review = new ProviderPayoutBeneficiaryService.Review(11L, 75L, 9L, 42L, null, 42L);
    SupervisionSuggestion card;

    @BeforeEach void setup() throws Exception {
        card = new SupervisionSuggestion(7L, 75L, "fin", null, "Bénéficiaire du versement · mission #11", "Atelier",
                clock.instant().plusSeconds(3600));
        card.setId(3L); card.setActionType(SupervisionActionType.PROVIDER_PAYOUT_BENEFICIARY);
        card.setActionParams(mapper.writeValueAsString(review)); card.setAppliedBy("user:admin");
        when(beneficiaries.review(11L, 7L)).thenReturn(Optional.of(review));
        when(beneficiaries.choice(11L, 7L)).thenReturn(new ProviderPayoutBeneficiaryService.Choice(9L, "Atelier Exemple", false, false, null));
        when(transactions.getTransaction(any())).thenReturn(mock(TransactionStatus.class));
    }
    @Test void financeProposesAllTradesWithImmutableAssignmentAndNoInventedAmount() {
        var property = new Property(); property.setId(75L);
        var mission = new Intervention(); mission.setId(11L); mission.setOrganizationId(7L);
        mission.setProperty(property); mission.setTitle("Réparation plomberie"); mission.setType("MAINTENANCE");
        when(interventions.findByPropertyId(75L, 7L)).thenReturn(List.of(mission));
        service.scanProperty(7L, 75L);
        verify(suggestions).recordActionable(eq(7L), eq(75L), eq("fin"), eq(card.getTitle()),
                contains("Atelier Exemple"), eq(SupervisionActionType.PROVIDER_PAYOUT_BENEFICIARY),
                eq(card.getActionParams()), isNull(), eq("info"));
        verifyNoInteractions(payouts);
    }
    @Test void staleCardsAreRetiredBeforeNewProposalWithoutHumanRefusalCooldown() {
        pending();
        when(cards.retireObsolete(3L, 7L)).thenReturn(1);
        service.scanProperty(7L, 75L);
        verify(cards).retireObsolete(3L, 7L);
        verify(realtime).publishPendingResolved(75L, 3L, "edited", null);
    }
    @Test void inlineSelectionClosesOnlyItsOwnMissionAndNeverOverwritesAppliedCards() throws Exception {
        pending();
        service.selected(new ProviderPayoutBeneficiaryService.Selected(12L, 7L, 75L));
        verify(cards, never()).retireObsolete(any(), any());
        service.selected(new ProviderPayoutBeneficiaryService.Selected(11L, 7L, 75L));
        verify(cards).retireObsolete(3L, 7L);
        verifyNoInteractions(realtime); // CAS returned zero: a concurrent apply already owns it.
    }
    @Test void previewLoadsCurrentRecipientAndBlocksReassignedOrResolvedDecision() {
        assertThat(service.preview(card).recipients()).containsExactly("Atelier Exemple");
        when(beneficiaries.review(11L, 7L)).thenReturn(Optional.empty());
        assertThat(service.preview(card).blocked()).isNotBlank();
        assertThat(service.preview(card).recipients()).isEmpty();
        verifyNoInteractions(payouts);
    }
    @Test void decisionCommitsBeforeCanonicalPayoutCheck() {
        service.apply(card);
        var order = inOrder(beneficiaries, payouts);
        order.verify(beneficiaries).selectReviewedOrganization(7L, review, "admin");
        order.verify(payouts).processCompletedMission(11L, 7L);
    }
    @Test void failedReviewNeverTriggersPayout() {
        when(beneficiaries.selectReviewedOrganization(7L, review, "admin"))
                .thenThrow(new IllegalStateException("Stale"));
        assertThatThrownBy(() -> service.apply(card)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(payouts);
    }
    @Test void automationIsNeverAllowedEvenWhenFinanceIsAutonomous() {
        assertThat(SupervisionAutomatableTypes.find(SupervisionActionType.PROVIDER_PAYOUT_BENEFICIARY)).isEmpty();
        card.setAppliedBy(SupervisionSuggestion.APPLIED_BY_AUTO);
        assertThatThrownBy(() -> service.apply(card)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(payouts);
    }
    @Test void wrongPropertyExpiredOrMalformedCardCannotRedirectFunds() {
        card.setPropertyId(76L);
        assertThatThrownBy(() -> service.apply(card)).isInstanceOf(IllegalStateException.class);
        card.setPropertyId(75L); card.setExpiresAt(clock.instant().minusSeconds(1));
        assertThatThrownBy(() -> service.apply(card)).isInstanceOf(IllegalStateException.class);
        card.setActionParams("{}");
        assertThatThrownBy(() -> service.apply(card)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(payouts);
    }
    private void pending() {
        when(cards.findByOrganizationIdAndPropertyIdAndActionTypeAndStatus(7L, 75L,
                SupervisionActionType.PROVIDER_PAYOUT_BENEFICIARY, "PENDING")).thenReturn(List.of(card));
    }
}
