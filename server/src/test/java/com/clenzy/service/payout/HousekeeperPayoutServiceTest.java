package com.clenzy.service.payout;

import com.clenzy.dto.PricingConfigDto;
import com.clenzy.model.*;
import com.clenzy.model.HousekeeperPayoutRecord.Status;
import com.clenzy.repository.*;
import com.clenzy.service.NotificationService;
import com.clenzy.service.PricingConfigService;
import com.clenzy.payment.StripeGateway;
import com.stripe.model.Account;
import com.stripe.model.AccountLink;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Versements Baitly des prestataires de tous les métiers et de la marketplace.
 * Gate (preuve/onboarding), montants (commission via StripeAmounts), idempotence
 * (record unique + CAS), échec Stripe → FAILED + notif admins, relance admin.
 * AUCUN appel Stripe ne part quand le gate est KO ou le record déjà traité.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class HousekeeperPayoutServiceTest {

    @Mock private HousekeeperPayoutConfigRepository configRepository;
    @Mock private HousekeeperPayoutRecordRepository recordRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private InterventionPhotoRepository interventionPhotoRepository;
    @Mock private UserRepository userRepository;
    @Mock private StripeGateway stripeGateway;
    @Mock private PricingConfigService pricingConfigService;
    @Mock private NotificationService notificationService;
    @Mock private HousekeeperPayoutRecorder recorder;
    @Mock private com.clenzy.payment.payout.StripeConnectTransferClient transferClient;
    @Mock private PlatformTransactionManager transactionManager;

    @Mock private ProviderPayoutPolicy payoutPolicy;
    @Mock private ProviderPayoutAccountResolver payoutAccounts;
    @Mock private ProviderPayoutBeneficiaryService beneficiaries;
    @Mock private ProviderPayoutMissionReader missionReader;

    private HousekeeperPayoutService service;

    @BeforeEach
    void setUp() {
        service = new HousekeeperPayoutService(configRepository, recordRepository,
                interventionRepository, interventionPhotoRepository, userRepository,
                stripeGateway, pricingConfigService, notificationService, recorder, payoutPolicy, payoutAccounts, beneficiaries, missionReader, transferClient,
                transactionManager);
        when(payoutPolicy.commissionCategory(any())).thenReturn("entretien");
        when(payoutPolicy.payableGross(any())).thenAnswer(invocation -> {
            Intervention mission = invocation.getArgument(0);
            return mission.getActualCost() != null ? mission.getActualCost() : mission.getEstimatedCost();
        });
        when(payoutPolicy.blockingReason(any())).thenAnswer(invocation -> {
            Intervention mission = invocation.getArgument(0);
            return mission.getPaymentStatus() == PaymentStatus.PAID ? null : "PAYMENT_NOT_RECEIVED";
        });
        when(beneficiaries.resolve(11L, 7L)).thenReturn(Optional.of(new ProviderPayoutBeneficiaryService.Recipient(PayoutBeneficiary.user(42L), "kc-pro")));
        when(payoutAccounts.resolve(any(), any())).thenAnswer(invocation -> {
            Intervention mission = invocation.getArgument(0);
            return configRepository.findByUserIdAndOrganizationId(mission.getAssignedUser().getId(), mission.getOrganizationId());
        });
        // Commission désactivée par défaut (aucune config).
        PricingConfigDto dto = new PricingConfigDto();
        dto.setCommissionConfigs(List.of());
        when(pricingConfigService.getCurrentConfig()).thenReturn(dto);
        // URLs AccountLink (@Value non résolues hors contexte Spring).
        org.springframework.test.util.ReflectionTestUtils.setField(service, "proReturnUrl", "https://app.test/return");
        org.springframework.test.util.ReflectionTestUtils.setField(service, "proRefreshUrl", "https://app.test/refresh");
    }

    // ─── Fixtures ────────────────────────────────────────────────────────────

    private User pro() {
        User u = new User();
        u.setId(42L);
        u.setKeycloakId("kc-pro");
        u.setEmail("pro@x.fr");
        return u;
    }

    private Intervention cleaningIntervention(PaymentStatus paymentStatus, BigDecimal estimated) {
        Intervention i = new Intervention();
        i.setId(11L);
        i.setStatus(InterventionStatus.COMPLETED);
        i.setOrganizationId(7L);
        i.setTitle("Menage Duplex");
        i.setType(InterventionType.CLEANING.name());
        i.setPaymentStatus(paymentStatus);
        i.setEstimatedCost(estimated);
        i.setAssignedUser(pro());
        return i;
    }

    private void stubProofPresent(boolean present) {
        InterventionPhoto photo = new InterventionPhoto();
        when(interventionPhotoRepository.findByInterventionIdAndPhaseOrderByCreatedAtAsc(
                eq(11L), eq(InterventionPhoto.PhotoPhase.AFTER), eq(7L)))
                .thenReturn(present ? List.of(photo) : List.of());
    }

    private HousekeeperPayoutConfig onboardedConfig() {
        HousekeeperPayoutConfig c = new HousekeeperPayoutConfig();
        c.setId(5L);
        c.setUserId(42L);
        c.setOrganizationId(7L);
        c.setStripeAccountId("acct_123");
        c.setOnboardingCompleted(true);
        return c;
    }

    private void stubPendingRecord(long recordId) {
        HousekeeperPayoutRecord record = new HousekeeperPayoutRecord(7L, 42L, 11L,
                BigDecimal.valueOf(95), BigDecimal.ZERO, Status.PENDING);
        record.setId(recordId);
        when(recordRepository.findByInterventionId(11L)).thenReturn(Optional.of(record));
        lenient().when(recordRepository.findById(record.getId())).thenReturn(Optional.of(record));
    }

    private void enableCommission(double rate) {
        PricingConfigDto dto = new PricingConfigDto();
        dto.setCommissionConfigs(List.of(
                new PricingConfigDto.CommissionConfig("entretien", true, rate)));
        when(pricingConfigService.getCurrentConfig()).thenReturn(dto);
    }

    @Test void residualPayoutAppliesCommissionOnlyToTheRetainedThirtyEuros() throws Exception {
        var mission = cleaningIntervention(PaymentStatus.PARTIALLY_REFUNDED, new BigDecimal("35"));
        when(payoutPolicy.blockingReason(mission)).thenReturn(null);
        when(payoutPolicy.payableGross(mission)).thenReturn(new BigDecimal("30"));
        enableCommission(10); stubProofPresent(true);
        when(configRepository.findByUserIdAndOrganizationId(42L,7L)).thenReturn(Optional.of(onboardedConfig()));
        var record = new HousekeeperPayoutRecord(7L,42L,11L,new BigDecimal("27"),new BigDecimal("3"),Status.PENDING);
        record.setId(77L);
        when(recorder.insertRecord(eq(mission),any(),any(),any(),eq(Status.PENDING),isNull())).thenReturn(true);
        when(recordRepository.findByInterventionId(11L)).thenReturn(Optional.of(record));
        when(recordRepository.findById(77L)).thenReturn(Optional.of(record));
        when(transferClient.createTransfer(any())).thenReturn("tr_residual");
        service.processPayoutForIntervention(mission);
        verify(transferClient).createTransfer(argThat(i -> i.amount().compareTo(new BigDecimal("27")) == 0));
        verify(recorder).insertRecord(eq(mission),eq(PayoutBeneficiary.user(42L)),
                argThat(a -> a.compareTo(new BigDecimal("27")) == 0),argThat(a -> a.compareTo(new BigDecimal("3")) == 0),eq(Status.PENDING),isNull());
    }

    // ─── Onboarding AccountLink (flux mobile) ────────────────────────────────

    @Nested
    @DisplayName("generateOnboardingLink — AccountLink hébergé pour le mobile")
    class OnboardingLink {

        @Test
        void whenNoAccountYet_thenExpressAccountCreatedThenLinkReturned() throws Exception {
            when(configRepository.findByUserIdAndOrganizationId(42L, 7L)).thenReturn(Optional.empty());
            Account account = new Account();
            account.setId("acct_new");
            when(stripeGateway.createAccount(any())).thenReturn(account);
            AccountLink link = new AccountLink();
            link.setUrl("https://connect.stripe.com/setup/x");
            when(stripeGateway.createAccountLink(any())).thenReturn(link);

            String url = service.generateOnboardingLink(pro(), 7L);

            assertThat(url).isEqualTo("https://connect.stripe.com/setup/x");
            verify(recorder).persistAccountId(42L, 7L, "acct_new");
            verify(stripeGateway).createAccountLink(argThat(p ->
                    "acct_new".equals(p.getAccount())
                            && "https://app.test/return".equals(p.getReturnUrl())
                            && "https://app.test/refresh".equals(p.getRefreshUrl())));
        }

        @Test
        void whenAccountExists_thenNoNewAccountCreated() throws Exception {
            when(configRepository.findByUserIdAndOrganizationId(42L, 7L))
                    .thenReturn(Optional.of(onboardedConfig()));
            AccountLink link = new AccountLink();
            link.setUrl("https://connect.stripe.com/setup/y");
            when(stripeGateway.createAccountLink(any())).thenReturn(link);

            String url = service.generateOnboardingLink(pro(), 7L);

            assertThat(url).isEqualTo("https://connect.stripe.com/setup/y");
            verify(stripeGateway, never()).createAccount(any());
            verify(recorder, never()).persistAccountId(any(), any(), any());
        }
    }

    // ─── Gate ────────────────────────────────────────────────────────────────

    @Test
    void postCommitReadFailureAlertsWithoutUndoingTheCompletedAction() {
        when(missionReader.load(11L, 7L)).thenThrow(new IllegalStateException("database unavailable"));

        org.assertj.core.api.Assertions.assertThatCode(() -> service.processCompletedMission(11L, 7L))
                .doesNotThrowAnyException();

        verify(notificationService).notifyAdminsAndManagers(eq(NotificationKey.PAYOUT_FAILED), anyString(),
                contains("Aucun transfert émis"), eq("/interventions/11"));
        verifyNoInteractions(transferClient, recorder);
    }

    @Test
    void choosingCompanyBeforeCompletionDoesNotStartATransfer() {
        Intervention mission = cleaningIntervention(PaymentStatus.PAID, BigDecimal.valueOf(95));
        mission.setStatus(InterventionStatus.IN_PROGRESS);
        when(missionReader.load(11L, 7L)).thenReturn(mission);

        service.processCompletedMission(11L, 7L);

        verifyNoInteractions(transferClient, recorder, beneficiaries);
    }

    @Nested
    @DisplayName("gate — preuve, onboarding, paiement host")
    class Gate {

        @Test
        void whenProofMissing_thenBlockedWithReason_andNoStripeCall() throws Exception {
            Intervention intervention = cleaningIntervention(PaymentStatus.PAID, BigDecimal.valueOf(95));
            stubProofPresent(false);

            service.processPayoutForIntervention(intervention);

            verify(recorder).insertRecord(eq(intervention), any(), any(), any(),
                    eq(Status.BLOCKED), eq(HousekeeperPayoutRecord.REASON_PROOF_MISSING));
            verify(transferClient, never()).createTransfer(any());
        }

        @Test
        void whenOnboardingIncomplete_thenBlocked_andProNotified() throws Exception {
            Intervention intervention = cleaningIntervention(PaymentStatus.PAID, BigDecimal.valueOf(95));
            stubProofPresent(true);
            when(configRepository.findByUserIdAndOrganizationId(42L, 7L)).thenReturn(Optional.empty());
            when(recorder.insertRecord(any(), any(), any(), any(), eq(Status.BLOCKED),
                    eq(HousekeeperPayoutRecord.REASON_ONBOARDING_INCOMPLETE))).thenReturn(true);

            service.processPayoutForIntervention(intervention);

            verify(notificationService).send(eq("kc-pro"), eq(NotificationKey.PAYOUT_BLOCKED_ONBOARDING),
                    any(), contains("compte de versement"), any(), eq(7L), any());
            verify(transferClient, never()).createTransfer(any());
        }

        @Test
        void whenHostNotPaid_thenPendingFundsAreTraceable() throws Exception {
            Intervention intervention = cleaningIntervention(PaymentStatus.PENDING, BigDecimal.valueOf(95));

            service.processPayoutForIntervention(intervention);

            verify(recorder).insertRecord(any(), any(), any(), any(), eq(Status.BLOCKED), eq("PAYMENT_NOT_RECEIVED"));
            verify(transferClient, never()).createTransfer(any());
        }

        @Test
        void whenNoAssignee_thenAlertWithoutPayingAnArbitraryTeamMember() throws Exception {
            Intervention unassigned = cleaningIntervention(PaymentStatus.PAID, BigDecimal.valueOf(95));
            unassigned.setAssignedUser(null);
            when(beneficiaries.resolve(11L, 7L)).thenReturn(Optional.empty());
            service.processPayoutForIntervention(unassigned);

            verify(recorder, never()).insertRecord(any(), any(), any(), any(), any(), any());
            verify(transferClient, never()).createTransfer(any());
            verify(notificationService).notifyAdminsAndManagers(eq(NotificationKey.PAYOUT_FAILED), any(), contains("Bénéficiaire"), any());
        }
    }

    // ─── Transfert + montants ────────────────────────────────────────────────

    @Nested
    @DisplayName("transfert — montants, commission, idempotence")
    class Transfers {

        @Test void completedTeamMissionPaysTheDesignatedCompanyAccount() throws Exception {
            Intervention mission = okIntervention();
            mission.setAssignedUser(null);
            mission.setTeamId(99L);
            var company = PayoutBeneficiary.organization(9L);
            when(beneficiaries.resolve(11L,7L)).thenReturn(Optional.of(new ProviderPayoutBeneficiaryService.Recipient(company,null)));
            doReturn(Optional.of(onboardedConfig())).when(payoutAccounts).resolve(mission,company);
            when(recorder.insertRecord(any(),eq(company),any(),any(),eq(Status.PENDING),isNull())).thenReturn(true);
            var record = new HousekeeperPayoutRecord(7L,null,11L,new BigDecimal("95"),BigDecimal.ZERO,Status.PENDING);
            record.setBeneficiaryOrganizationId(9L); record.setId(77L);
            when(recordRepository.findById(77L)).thenReturn(Optional.of(record));
            when(recordRepository.findByInterventionId(11L)).thenReturn(Optional.of(record));
            when(transferClient.createTransfer(any())).thenReturn("tr_company");

            service.processPayoutForIntervention(mission);

            verify(transferClient).createTransfer(argThat(i -> i.beneficiaryUserId()==null
                    && i.beneficiaryOrganizationId().equals(9L) && i.idempotencyKey().equals("payout-intervention-11")));
            verify(recorder).markSent(77L,"tr_company");
            verify(notificationService,never()).send(any(),eq(NotificationKey.PAYOUT_SENT),any(),any(),any(),any(),any());
        }

        @org.junit.jupiter.params.ParameterizedTest
        @org.junit.jupiter.params.provider.ValueSource(strings = {"PLUMBING_REPAIR", "LAUNDRY", "GARDENING", "CHECK_IN", "CHEF", "CHAUFFEUR", "OTHER"})
        void everyMarketplaceTradeUsesTheSameTransferJournal(String type) throws Exception {
            Intervention mission = okIntervention();
            mission.setType(type);
            when(recorder.insertRecord(any(), any(), any(), any(), eq(Status.PENDING), isNull())).thenReturn(true);
            stubPendingRecord(77L);
            when(transferClient.createTransfer(any())).thenReturn("tr_trade");
            service.processPayoutForIntervention(mission);
            verify(transferClient).createTransfer(argThat(i -> i.source() == PayoutTransfer.Source.INTERVENTION
                    && i.beneficiaryUserId().equals(42L) && i.amount().compareTo(new BigDecimal("95")) == 0
                    && i.description().equals("Versement prestation #11")));
        }

        @Test
        void marketplaceCommissionUsesItsOwnCategory() throws Exception {
            Intervention mission = okIntervention();
            mission.setType("PLUMBING_REPAIR");
            when(payoutPolicy.commissionCategory(mission)).thenReturn("travaux");
            PricingConfigDto pricing = new PricingConfigDto();
            pricing.setCommissionConfigs(List.of(new PricingConfigDto.CommissionConfig("travaux", true, 12.0),
                    new PricingConfigDto.CommissionConfig("entretien", true, 5.0)));
            when(pricingConfigService.getCurrentConfig()).thenReturn(pricing);
            service.processPayoutForIntervention(mission);
            verify(recorder).insertRecord(eq(mission), any(), eq(new BigDecimal("83.60")), eq(new BigDecimal("11.40")), eq(Status.PENDING), isNull());
        }

        @Test
        void insufficientPlatformFundsLeaveARecoverableFailureWithoutSuccessNotification() throws Exception {
            stubPendingRecord(77L);
            when(transferClient.createTransfer(any())).thenThrow(new PayoutFundsUnavailableException("Solde insuffisant. Aucun transfert émis."));
            service.executeTransfer(77L,11L,"Prestation",new BigDecimal("95"),"acct_123","kc-pro",7L);
            verify(recorder).markFailed(eq(77L),contains("Solde insuffisant"));
            verify(recorder,never()).markSent(any(),any());
            verify(recorder,never()).markReconciliationRequired(any());
        }

        @Test
        void uncertainTransferIsBlockedWithoutIncrementingRetryOrNotifyingSuccess() throws Exception {
            Intervention mission = okIntervention();
            when(recorder.insertRecord(any(), any(), any(), any(), eq(Status.PENDING), isNull())).thenReturn(true);
            stubPendingRecord(77L);
            when(transferClient.createTransfer(any())).thenThrow(new PayoutReconciliationRequiredException("À rapprocher", null, null));
            service.processPayoutForIntervention(mission);
            verify(recorder).markReconciliationRequired(77L);
            verify(recorder, never()).markFailed(any(), any());
            verify(recorder, never()).markSent(any(), any());
        }

        @Test
        void reconciliationAlertIsStillAttemptedWhenRecordingTheBlockedStatusFails() throws Exception {
            stubPendingRecord(77L);
            var uncertain = new PayoutReconciliationRequiredException("À rapprocher", null, null);
            when(transferClient.createTransfer(any())).thenThrow(uncertain);
            var databaseFailure = new IllegalStateException("Database unavailable");
            when(recorder.markReconciliationRequired(77L)).thenThrow(databaseFailure);

            assertThatThrownBy(() -> service.executeTransfer(77L, 11L, "Prestation", new BigDecimal("95"),
                    "acct_123", "kc-pro", 7L)).isSameAs(uncertain);

            verify(notificationService).notifyAdminsAndManagers(eq(NotificationKey.PAYOUT_FAILED),
                    any(), contains("À rapprocher"), any());
            assertThat(uncertain.getSuppressed()).containsExactly(databaseFailure);
            verify(recorder, never()).markSent(any(), any());
        }

        private Intervention okIntervention() {
            Intervention intervention = cleaningIntervention(PaymentStatus.PAID, BigDecimal.valueOf(95));
            stubProofPresent(true);
            when(configRepository.findByUserIdAndOrganizationId(42L, 7L))
                    .thenReturn(Optional.of(onboardedConfig()));
            return intervention;
        }

        @Test
        void whenGateOk_thenTransferSentWithExactMinorUnits_andProNotified() throws Exception {
            Intervention intervention = okIntervention();
            when(recorder.insertRecord(any(), any(), eq(BigDecimal.valueOf(95).setScale(2)), any(),
                    eq(Status.PENDING), isNull())).thenReturn(true);
            stubPendingRecord(77L);
            when(transferClient.createTransfer(any())).thenReturn("tr_123");
            when(recorder.markSent(77L, "tr_123")).thenReturn(1);

            service.processPayoutForIntervention(intervention);

            ArgumentCaptor<com.clenzy.service.payout.PayoutTransferInstruction> instruction =
                    ArgumentCaptor.forClass(com.clenzy.service.payout.PayoutTransferInstruction.class);
            verify(transferClient).createTransfer(instruction.capture());
            assertThat(instruction.getValue().amount()).isEqualByComparingTo("95.00");
            assertThat(instruction.getValue().destination()).isEqualTo("acct_123");
            assertThat(instruction.getValue().idempotencyKey()).isEqualTo("payout-intervention-11");
            assertThat(instruction.getValue().beneficiaryUserId()).isEqualTo(42L);
            verify(notificationService).send(eq("kc-pro"), eq(NotificationKey.PAYOUT_SENT),
                    any(), contains("95"), any(), eq(7L), any());
        }

        @Test
        void whenTransactionActive_thenTransferRunsAfterCommit_outsideTheFinishedTransaction() throws Exception {
            // Apres commit, la transaction terminee reste liee au thread : sans suspension
            // (NOT_SUPPORTED), la notification PAYOUT_SENT la rejoindrait et serait perdue.
            Intervention intervention = okIntervention();
            when(recorder.insertRecord(any(), any(), any(), any(), eq(Status.PENDING), isNull())).thenReturn(true);
            stubPendingRecord(77L);
            when(transferClient.createTransfer(any())).thenReturn("tr_123");
            when(recorder.markSent(77L, "tr_123")).thenReturn(1);

            when(missionReader.load(11L, 7L)).thenReturn(intervention);
            TransactionSynchronizationManager.initSynchronization();
            try {
                service.processPayoutForIntervention(intervention);
                verify(transferClient, never()).createTransfer(any());
                verify(recorder, never()).insertRecord(any(),any(),any(),any(),any(),any());

                TransactionSynchronizationManager.getSynchronizations()
                        .forEach(TransactionSynchronization::afterCommit);
            } finally {
                TransactionSynchronizationManager.clearSynchronization();
            }

            InOrder order = inOrder(transactionManager, transferClient, notificationService);
            order.verify(transactionManager).getTransaction(argThat(definition ->
                    definition.getPropagationBehavior() == TransactionDefinition.PROPAGATION_NOT_SUPPORTED));
            order.verify(transferClient).createTransfer(any());
            order.verify(notificationService).send(eq("kc-pro"), eq(NotificationKey.PAYOUT_SENT),
                    any(), any(), any(), eq(7L), any());
            order.verify(transactionManager).commit(any());
        }

        @Test
        void whenCommissionEnabled_thenDeductedExactly() throws Exception {
            enableCommission(10.0); // 95 − 9.50 = 85.50 → 8550 centimes
            Intervention intervention = okIntervention();
            when(recorder.insertRecord(any(), any(), eq(new BigDecimal("85.50")), eq(new BigDecimal("9.50")),
                    eq(Status.PENDING), isNull())).thenReturn(true);
            HousekeeperPayoutRecord record = new HousekeeperPayoutRecord(7L, 42L, 11L,
                    new BigDecimal("85.50"), new BigDecimal("9.50"), Status.PENDING);
            record.setId(77L);
            when(recordRepository.findByInterventionId(11L)).thenReturn(Optional.of(record));
            lenient().when(recordRepository.findById(record.getId())).thenReturn(Optional.of(record));
            when(transferClient.createTransfer(any())).thenReturn("tr_123");
            when(recorder.markSent(anyLong(), any())).thenReturn(1);

            service.processPayoutForIntervention(intervention);

            verify(transferClient).createTransfer(argThat(i -> i.amount().compareTo(new BigDecimal("85.50")) == 0));
        }

        @Test
        void whenCommissionExceedsAmount_thenBlockedCleanly_noStripeCall() throws Exception {
            enableCommission(150.0);
            Intervention intervention = okIntervention();

            service.processPayoutForIntervention(intervention);

            verify(recorder).insertRecord(any(), any(), any(), any(),
                    eq(Status.BLOCKED), eq("AMOUNT_NOT_POSITIVE"));
            verify(transferClient, never()).createTransfer(any());
        }

        @Test
        void whenRecordAlreadyExists_thenNoSecondTransfer() throws Exception {
            Intervention intervention = okIntervention();
            // insertRecord false = contrainte unique / record déjà présent (double validation).
            when(recorder.insertRecord(any(), any(), any(), any(), eq(Status.PENDING), isNull()))
                    .thenReturn(false);

            service.processPayoutForIntervention(intervention);
            service.processPayoutForIntervention(intervention);

            verify(transferClient, never()).createTransfer(any());
        }

        @Test
        void whenStripeFails_thenRecordFailed_andAdminsNotified() throws Exception {
            Intervention intervention = okIntervention();
            when(recorder.insertRecord(any(), any(), any(), any(), eq(Status.PENDING), isNull()))
                    .thenReturn(true);
            stubPendingRecord(77L);
            when(transferClient.createTransfer(any()))
                    .thenThrow(new com.stripe.exception.ApiException("insufficient funds", null, null, 400, null));

            service.processPayoutForIntervention(intervention);

            verify(recorder).markFailed(eq(77L), contains("insufficient funds"));
            verify(notificationService).notifyAdminsAndManagers(eq(NotificationKey.PAYOUT_FAILED),
                    any(), contains("Vérifiez son état"), any());
            verify(notificationService, never()).send(any(), eq(NotificationKey.PAYOUT_SENT),
                    any(), any(), any(), any(Long.class));
        }
    }

    // ─── Relance admin ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("retryPayout — relance admin")
    class Retry {

        private void payableBlockedRecord() {
            var record = new HousekeeperPayoutRecord(7L, 42L, 11L, BigDecimal.ZERO, BigDecimal.ZERO, Status.BLOCKED);
            record.setId(77L);
            when(recordRepository.findById(77L)).thenReturn(Optional.of(record));
            when(missionReader.load(11L, 7L)).thenReturn(cleaningIntervention(PaymentStatus.PAID, BigDecimal.valueOf(95)));
            stubProofPresent(true);
            when(configRepository.findByUserIdAndOrganizationId(42L, 7L)).thenReturn(Optional.of(onboardedConfig()));
        }

        @Test
        void previewRecomputesPreviouslyZeroAmountWithoutWritingOrTransferring() throws Exception {
            payableBlockedRecord();
            var quote = service.previewRetry(77L, 7L);
            assertThat(quote.amount()).isEqualByComparingTo("95");
            assertThat(recordRepository.findById(77L).orElseThrow().getAmount()).isZero();
            verifyNoInteractions(recorder);
            verify(transferClient, never()).createTransfer(any());
        }

        @Test
        void changedConfirmedAmountBlocksBeforeRequeue() throws Exception {
            payableBlockedRecord();
            assertThatThrownBy(() -> service.retryPayout(77L, 7L,
                    new com.clenzy.dto.HousekeeperPayoutDtos.RetryQuote(BigDecimal.ZERO, BigDecimal.ZERO)))
                    .isInstanceOf(com.clenzy.exception.BaitlyPayoutNotReadyException.class)
                    .hasMessageContaining("montant a changé");
            verifyNoInteractions(recorder);
            verify(transferClient, never()).createTransfer(any());
        }

        @Test
        void changedConfirmedCommissionBlocksBeforeRequeue() {
            payableBlockedRecord();
            assertThatThrownBy(() -> service.retryPayout(77L, 7L,
                    new com.clenzy.dto.HousekeeperPayoutDtos.RetryQuote(BigDecimal.valueOf(95), BigDecimal.ONE)))
                    .hasMessageContaining("montant a changé");
            verifyNoInteractions(recorder);
        }

        @Test
        void unchangedQuoteRequeuesItsExactAmount() {
            payableBlockedRecord();
            service.retryPayout(77L, 7L, service.previewRetry(77L, 7L));
            verify(recorder).requeueRecord(eq(77L), eq(Status.BLOCKED), eq(new BigDecimal("95.00")), eq(BigDecimal.ZERO));
        }

        @Test
        void previewDoesNotExposeOtherOrganizations() {
            var record = new HousekeeperPayoutRecord(666L, 42L, 11L, BigDecimal.TEN, BigDecimal.ZERO, Status.BLOCKED);
            when(recordRepository.findById(77L)).thenReturn(Optional.of(record));
            assertThatThrownBy(() -> service.previewRetry(77L, 7L))
                    .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
            verifyNoInteractions(recorder);
        }

        @Test
        void reconciliationRequiredCannotProduceRetryQuote() {
            var record = new HousekeeperPayoutRecord(7L, 42L, 11L, BigDecimal.TEN, BigDecimal.ZERO, Status.BLOCKED);
            record.setFailureReason("RECONCILIATION_REQUIRED");
            when(recordRepository.findById(77L)).thenReturn(Optional.of(record));
            assertThatThrownBy(() -> service.previewRetry(77L, 7L)).hasMessageContaining("rapproché");
            verifyNoInteractions(recorder);
        }

        @Test
        void whenFailedAndGateNowOk_thenRequeuedAndTransferred() throws Exception {
            HousekeeperPayoutRecord record = new HousekeeperPayoutRecord(7L, 42L, 11L,
                    BigDecimal.valueOf(95), BigDecimal.ZERO, Status.FAILED);
            record.setId(77L);
            when(recordRepository.findById(77L)).thenReturn(Optional.of(record));
            Intervention intervention = cleaningIntervention(PaymentStatus.PAID, BigDecimal.valueOf(95));
            when(missionReader.load(11L, 7L)).thenReturn(intervention);
            stubProofPresent(true);
            when(configRepository.findByUserIdAndOrganizationId(42L, 7L))
                    .thenReturn(Optional.of(onboardedConfig()));
            when(recorder.requeueRecord(eq(77L), eq(Status.FAILED), any(), any())).thenReturn(1);
            when(transferClient.createTransfer(any())).thenReturn("tr_retry");
            when(recorder.markSent(77L, "tr_retry")).thenReturn(1);

            service.retryPayout(77L, 7L);

            verify(transferClient).createTransfer(argThat(i -> i.idempotencyKey().equals("payout-intervention-11")));
        }

        @Test
        void whenAlreadySent_thenNoNewStripeCall() throws Exception {
            HousekeeperPayoutRecord record = new HousekeeperPayoutRecord(7L, 42L, 11L,
                    BigDecimal.valueOf(95), BigDecimal.ZERO, Status.SENT);
            record.setId(77L);
            when(recordRepository.findById(77L)).thenReturn(Optional.of(record));

            service.retryPayout(77L, 7L);

            verify(transferClient, never()).createTransfer(any());
        }

        @Test
        void whenCrossOrg_thenAccessDenied() {
            HousekeeperPayoutRecord record = new HousekeeperPayoutRecord(666L, 42L, 11L,
                    BigDecimal.valueOf(95), BigDecimal.ZERO, Status.FAILED);
            record.setId(77L);
            when(recordRepository.findById(77L)).thenReturn(Optional.of(record));

            assertThatThrownBy(() -> service.retryPayout(77L, 7L))
                    .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        }
    }
}
