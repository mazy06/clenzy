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
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Moteur Ménage 3B (P9) — money-path du payout housekeeper.
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

    private HousekeeperPayoutService service;

    @BeforeEach
    void setUp() {
        service = new HousekeeperPayoutService(configRepository, recordRepository,
                interventionRepository, interventionPhotoRepository, userRepository,
                stripeGateway, pricingConfigService, notificationService, recorder, transferClient);
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
    }

    private void enableCommission(double rate) {
        PricingConfigDto dto = new PricingConfigDto();
        dto.setCommissionConfigs(List.of(
                new PricingConfigDto.CommissionConfig("entretien", true, rate)));
        when(pricingConfigService.getCurrentConfig()).thenReturn(dto);
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
            verify(transferClient, never()).createTransfer(any(), any(), any(), any(), any());
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
                    any(), contains("compte de versement"), any(), eq(7L));
            verify(transferClient, never()).createTransfer(any(), any(), any(), any(), any());
        }

        @Test
        void whenHostNotPaid_thenNothingHappens() throws Exception {
            Intervention intervention = cleaningIntervention(PaymentStatus.PENDING, BigDecimal.valueOf(95));

            service.processPayoutForIntervention(intervention);

            verify(recorder, never()).insertRecord(any(), any(), any(), any(), any(), any());
            verify(transferClient, never()).createTransfer(any(), any(), any(), any(), any());
        }

        @Test
        void whenNotCleaningOrNoAssignee_thenNothingHappens() throws Exception {
            Intervention maintenance = cleaningIntervention(PaymentStatus.PAID, BigDecimal.valueOf(95));
            maintenance.setType("PREVENTIVE_MAINTENANCE");
            service.processPayoutForIntervention(maintenance);

            Intervention unassigned = cleaningIntervention(PaymentStatus.PAID, BigDecimal.valueOf(95));
            unassigned.setAssignedUser(null);
            service.processPayoutForIntervention(unassigned);

            verify(recorder, never()).insertRecord(any(), any(), any(), any(), any(), any());
            verify(transferClient, never()).createTransfer(any(), any(), any(), any(), any());
        }
    }

    // ─── Transfert + montants ────────────────────────────────────────────────

    @Nested
    @DisplayName("transfert — montants, commission, idempotence")
    class Transfers {

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
            when(transferClient.createTransfer(any(), any(), any(), any(), any())).thenReturn("tr_123");
            when(recorder.markSent(77L, "tr_123")).thenReturn(1);

            service.processPayoutForIntervention(intervention);

            ArgumentCaptor<BigDecimal> amount = ArgumentCaptor.forClass(BigDecimal.class);
            ArgumentCaptor<String> dest = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<String> idem = ArgumentCaptor.forClass(String.class);
            verify(transferClient).createTransfer(amount.capture(), any(), dest.capture(), any(), idem.capture());
            assertThat(amount.getValue()).isEqualByComparingTo("95.00"); // net exact
            assertThat(dest.getValue()).isEqualTo("acct_123");
            assertThat(idem.getValue()).isEqualTo("payout-intervention-11");
            verify(notificationService).send(eq("kc-pro"), eq(NotificationKey.PAYOUT_SENT),
                    any(), contains("95"), any(), eq(7L));
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
            when(transferClient.createTransfer(any(), any(), any(), any(), any())).thenReturn("tr_123");
            when(recorder.markSent(anyLong(), any())).thenReturn(1);

            service.processPayoutForIntervention(intervention);

            ArgumentCaptor<BigDecimal> amount = ArgumentCaptor.forClass(BigDecimal.class);
            verify(transferClient).createTransfer(amount.capture(), any(), any(), any(), any());
            assertThat(amount.getValue()).isEqualByComparingTo("85.50");
        }

        @Test
        void whenCommissionExceedsAmount_thenBlockedCleanly_noStripeCall() throws Exception {
            enableCommission(150.0);
            Intervention intervention = okIntervention();

            service.processPayoutForIntervention(intervention);

            verify(recorder).insertRecord(any(), any(), any(), any(),
                    eq(Status.BLOCKED), eq("AMOUNT_NOT_POSITIVE"));
            verify(transferClient, never()).createTransfer(any(), any(), any(), any(), any());
        }

        @Test
        void whenRecordAlreadyExists_thenNoSecondTransfer() throws Exception {
            Intervention intervention = okIntervention();
            // insertRecord false = contrainte unique / record déjà présent (double validation).
            when(recorder.insertRecord(any(), any(), any(), any(), eq(Status.PENDING), isNull()))
                    .thenReturn(false);

            service.processPayoutForIntervention(intervention);
            service.processPayoutForIntervention(intervention);

            verify(transferClient, never()).createTransfer(any(), any(), any(), any(), any());
        }

        @Test
        void whenStripeFails_thenRecordFailed_andAdminsNotified() throws Exception {
            Intervention intervention = okIntervention();
            when(recorder.insertRecord(any(), any(), any(), any(), eq(Status.PENDING), isNull()))
                    .thenReturn(true);
            stubPendingRecord(77L);
            when(transferClient.createTransfer(any(), any(), any(), any(), any()))
                    .thenThrow(new com.stripe.exception.ApiException("insufficient funds", null, null, 400, null));

            service.processPayoutForIntervention(intervention);

            verify(recorder).markFailed(eq(77L), contains("insufficient funds"));
            verify(notificationService).notifyAdminsAndManagers(eq(NotificationKey.PAYOUT_FAILED),
                    any(), contains("Relance manuelle requise"), any());
            verify(notificationService, never()).send(any(), eq(NotificationKey.PAYOUT_SENT),
                    any(), any(), any(), any());
        }
    }

    // ─── Relance admin ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("retryPayout — relance admin")
    class Retry {

        @Test
        void whenFailedAndGateNowOk_thenRequeuedAndTransferred() throws Exception {
            HousekeeperPayoutRecord record = new HousekeeperPayoutRecord(7L, 42L, 11L,
                    BigDecimal.valueOf(95), BigDecimal.ZERO, Status.FAILED);
            record.setId(77L);
            when(recordRepository.findById(77L)).thenReturn(Optional.of(record));
            Intervention intervention = cleaningIntervention(PaymentStatus.PAID, BigDecimal.valueOf(95));
            when(interventionRepository.findById(11L)).thenReturn(Optional.of(intervention));
            stubProofPresent(true);
            when(configRepository.findByUserIdAndOrganizationId(42L, 7L))
                    .thenReturn(Optional.of(onboardedConfig()));
            when(recorder.requeueRecord(eq(77L), eq(Status.FAILED), any(), any())).thenReturn(1);
            when(transferClient.createTransfer(any(), any(), any(), any(), any())).thenReturn("tr_retry");
            when(recorder.markSent(77L, "tr_retry")).thenReturn(1);

            service.retryPayout(77L, 7L);

            verify(transferClient).createTransfer(any(), any(), any(), any(), eq("payout-intervention-11"));
        }

        @Test
        void whenAlreadySent_thenNoNewStripeCall() throws Exception {
            HousekeeperPayoutRecord record = new HousekeeperPayoutRecord(7L, 42L, 11L,
                    BigDecimal.valueOf(95), BigDecimal.ZERO, Status.SENT);
            record.setId(77L);
            when(recordRepository.findById(77L)).thenReturn(Optional.of(record));

            service.retryPayout(77L, 7L);

            verify(transferClient, never()).createTransfer(any(), any(), any(), any(), any());
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
