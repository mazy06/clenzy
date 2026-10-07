package com.clenzy.service;

import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import com.clenzy.payment.payout.PayoutExecutor;
import com.clenzy.payment.payout.PayoutExecutor.PayoutExecutionException;
import com.clenzy.payment.payout.PayoutExecutorRegistry;
import com.clenzy.repository.OwnerPayoutConfigRepository;
import com.clenzy.repository.OwnerPayoutRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PayoutExecutionServiceTest {

    @Mock private OwnerPayoutRepository payoutRepository;
    @Mock private OwnerPayoutConfigRepository configRepository;
    @Mock private PayoutExecutorRegistry executorRegistry;
    @Mock private PayoutExecutor executor;
    @Mock private com.clenzy.service.payout.OwnerPayoutFundingService fundingService;

    private PayoutExecutionService service;

    @Mock private com.clenzy.service.payout.PayoutTransferJournal transferJournal;

    @BeforeEach
    void setUp() {
        lenient().when(payoutRepository.claimExecution(anyLong(), anyLong(), any(), any(), any())).thenReturn(1);
        lenient().when(payoutRepository.claimRetry(anyLong(), anyLong(), any(), any())).thenReturn(1);
        service = new PayoutExecutionService(payoutRepository, configRepository, executorRegistry, fundingService, transferJournal);
    }

    @Test
    void missingFundingStopsBeforeAnyPaymentRailIsSelected() {
        OwnerPayout payout = buildPayout(1L, PayoutStatus.APPROVED);
        when(payoutRepository.findByIdAndOrgId(1L, 1L)).thenReturn(Optional.of(payout));
        doThrow(new IllegalStateException("Rapprochement requis")).when(fundingService).validate(payout);
        assertThatThrownBy(() -> service.executePayout(1L, 1L)).hasMessage("Rapprochement requis");
        verifyNoInteractions(configRepository, executorRegistry, executor);
    }

    @Test
    void missingFundingDoesNotResetFailedPayoutDuringRetry() {
        OwnerPayout payout = buildPayout(1L, PayoutStatus.FAILED);
        when(payoutRepository.findByIdAndOrgId(1L, 1L)).thenReturn(Optional.of(payout));
        doThrow(new IllegalStateException("Rapprochement requis")).when(fundingService).validate(payout);
        assertThatThrownBy(() -> service.retryPayout(1L, 1L)).hasMessage("Rapprochement requis");
        assertThat(payout.getStatus()).isEqualTo(PayoutStatus.FAILED);
        verify(payoutRepository, never()).save(any());
        verifyNoInteractions(executorRegistry, executor);
    }

    private OwnerPayout buildPayout(Long id, PayoutStatus status) {
        OwnerPayout p = new OwnerPayout();
        p.setId(id);
        p.setOrganizationId(1L);
        p.setOwnerId(5L);
        p.setPeriodStart(LocalDate.of(2025, 1, 1));
        p.setPeriodEnd(LocalDate.of(2025, 1, 31));
        p.setNetAmount(new BigDecimal("250.00"));
        p.setCommissionRate(new BigDecimal("0.10"));
        p.setStatus(status);
        return p;
    }

    @Test
    void losingConcurrentExecutionDoesNotCallProvider() {
        var payout = buildPayout(1L, PayoutStatus.APPROVED);
        var config = buildConfig(true, PayoutMethod.STRIPE_CONNECT);
        when(payoutRepository.findByIdAndOrgId(1L,1L)).thenReturn(Optional.of(payout));
        when(configRepository.findByOwnerIdAndOrgId(5L,1L)).thenReturn(Optional.of(config));
        when(executorRegistry.get(PayoutMethod.STRIPE_CONNECT)).thenReturn(executor);
        when(payoutRepository.claimExecution(anyLong(),anyLong(),any(),any(),any())).thenReturn(0);
        assertThatThrownBy(() -> service.executePayout(1L,1L)).hasMessageContaining("déjà pris en charge");
        verify(executor,never()).execute(any(),any());
    }

    @Test
    void invalidConfigurationDoesNotReserveExecution() {
        var payout = buildPayout(1L, PayoutStatus.APPROVED);
        var config = buildConfig(true, PayoutMethod.STRIPE_CONNECT);
        when(payoutRepository.findByIdAndOrgId(1L,1L)).thenReturn(Optional.of(payout));
        when(configRepository.findByOwnerIdAndOrgId(5L,1L)).thenReturn(Optional.of(config));
        when(executorRegistry.get(PayoutMethod.STRIPE_CONNECT)).thenReturn(executor);
        doThrow(new PayoutExecutionException("Compte manquant")).when(executor).validate(payout,config);
        assertThatThrownBy(() -> service.executePayout(1L,1L)).hasMessage("Compte manquant");
        verify(payoutRepository,never()).claimExecution(anyLong(),anyLong(),any(),any(),any());
        assertThat(payout.getStatus()).isEqualTo(PayoutStatus.APPROVED);
    }

    @Test
    void cannotSwitchPreviouslySelectedPaymentRail() {
        var payout = buildPayout(1L,PayoutStatus.APPROVED); payout.setPayoutMethod(PayoutMethod.STRIPE_CONNECT);
        when(payoutRepository.findByIdAndOrgId(1L,1L)).thenReturn(Optional.of(payout));
        when(configRepository.findByOwnerIdAndOrgId(5L,1L)).thenReturn(Optional.of(buildConfig(true,PayoutMethod.WISE)));
        assertThatThrownBy(() -> service.executePayout(1L,1L)).hasMessageContaining("rail");
        verifyNoInteractions(executor);
    }

    private OwnerPayoutConfig buildConfig(boolean verified, PayoutMethod method) {
        OwnerPayoutConfig c = new OwnerPayoutConfig();
        c.setOrganizationId(1L);
        c.setOwnerId(5L);
        c.setVerified(verified);
        c.setPayoutMethod(method);
        return c;
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(value = PayoutMethod.class, names = { "MANUAL", "SEPA_TRANSFER" })
    void legacyRailCannotStartOrRetryAPayout(PayoutMethod method) {
        var payout = buildPayout(1L, PayoutStatus.APPROVED);
        when(payoutRepository.findByIdAndOrgId(1L, 1L)).thenReturn(Optional.of(payout));
        when(configRepository.findByOwnerIdAndOrgId(5L, 1L)).thenReturn(Optional.of(buildConfig(true, method)));
        assertThatThrownBy(() -> service.executePayout(1L, 1L)).hasMessageContaining("désactivés");
        assertThat(payout.getStatus()).isEqualTo(PayoutStatus.APPROVED);
        payout.setStatus(PayoutStatus.FAILED);
        assertThatThrownBy(() -> service.retryPayout(1L, 1L)).hasMessageContaining("désactivés");
        assertThat(payout.getStatus()).isEqualTo(PayoutStatus.FAILED);
        verify(payoutRepository, never()).claimExecution(anyLong(), anyLong(), any(), any(), any());
        verify(payoutRepository, never()).claimRetry(anyLong(), anyLong(), any(), any());
        verifyNoInteractions(executorRegistry, executor);
    }

    @Nested
    @DisplayName("executePayout")
    class ExecutePayout {

        @Test
        @DisplayName("throws when payout not found")
        void payoutNotFound_throws() {
            when(payoutRepository.findByIdAndOrgId(1L, 1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.executePayout(1L, 1L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Payout not found");
        }

        @Test
        @DisplayName("throws when status not APPROVED")
        void wrongStatus_throws() {
            OwnerPayout payout = buildPayout(1L, PayoutStatus.PENDING);
            when(payoutRepository.findByIdAndOrgId(1L, 1L)).thenReturn(Optional.of(payout));

            assertThatThrownBy(() -> service.executePayout(1L, 1L))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("APPROVED");
        }

        @Test
        @DisplayName("throws when owner has no config")
        void noConfig_throws() {
            OwnerPayout payout = buildPayout(1L, PayoutStatus.APPROVED);
            when(payoutRepository.findByIdAndOrgId(1L, 1L)).thenReturn(Optional.of(payout));
            when(configRepository.findByOwnerIdAndOrgId(5L, 1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.executePayout(1L, 1L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("methode de paiement");
        }

        @Test
        @DisplayName("throws when config not verified")
        void notVerified_throws() {
            OwnerPayout payout = buildPayout(1L, PayoutStatus.APPROVED);
            OwnerPayoutConfig config = buildConfig(false, PayoutMethod.STRIPE_CONNECT);
            when(payoutRepository.findByIdAndOrgId(1L, 1L)).thenReturn(Optional.of(payout));
            when(configRepository.findByOwnerIdAndOrgId(5L, 1L)).thenReturn(Optional.of(config));

            assertThatThrownBy(() -> service.executePayout(1L, 1L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("pas encore verifiee");
        }

        @Test
        @DisplayName("rejects a missing PSP method without reserving execution")
        void nullMethod_doesNotFallBackToManualPayment() {
            OwnerPayout payout = buildPayout(1L, PayoutStatus.APPROVED);
            OwnerPayoutConfig config = buildConfig(true, null);
            when(payoutRepository.findByIdAndOrgId(1L, 1L)).thenReturn(Optional.of(payout));
            when(configRepository.findByOwnerIdAndOrgId(5L, 1L)).thenReturn(Optional.of(config));

            assertThatThrownBy(() -> service.executePayout(1L, 1L))
                    .hasMessageContaining("compte de versement PSP");
            verify(payoutRepository, never()).claimExecution(anyLong(), anyLong(), any(), any(), any());
            verify(executor, never()).execute(any(), any());
        }

        @Test
        @DisplayName("delegates to executor for configured method")
        void executesViaRegistry() {
            OwnerPayout payout = buildPayout(1L, PayoutStatus.APPROVED);
            OwnerPayoutConfig config = buildConfig(true, PayoutMethod.STRIPE_CONNECT);
            when(payoutRepository.findByIdAndOrgId(1L, 1L)).thenReturn(Optional.of(payout));
            when(configRepository.findByOwnerIdAndOrgId(5L, 1L)).thenReturn(Optional.of(config));
            when(executorRegistry.get(PayoutMethod.STRIPE_CONNECT)).thenReturn(executor);
            when(executor.execute(payout, config)).thenReturn(payout);

            service.executePayout(1L, 1L);

            verify(executor).execute(payout, config);
        }

        @Test
        @DisplayName("wraps registry exception as IllegalArgument")
        void registryThrows_wraps() {
            OwnerPayout payout = buildPayout(1L, PayoutStatus.APPROVED);
            OwnerPayoutConfig config = buildConfig(true, PayoutMethod.WISE);
            when(payoutRepository.findByIdAndOrgId(1L, 1L)).thenReturn(Optional.of(payout));
            when(configRepository.findByOwnerIdAndOrgId(5L, 1L)).thenReturn(Optional.of(config));
            when(executorRegistry.get(PayoutMethod.WISE))
                    .thenThrow(new PayoutExecutionException("no executor for WISE"));

            assertThatThrownBy(() -> service.executePayout(1L, 1L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("no executor for WISE");
        }

        @Test
        @DisplayName("wraps executor exception as IllegalArgument")
        void executorThrows_wraps() {
            OwnerPayout payout = buildPayout(1L, PayoutStatus.APPROVED);
            OwnerPayoutConfig config = buildConfig(true, PayoutMethod.STRIPE_CONNECT);
            when(payoutRepository.findByIdAndOrgId(1L, 1L)).thenReturn(Optional.of(payout));
            when(configRepository.findByOwnerIdAndOrgId(5L, 1L)).thenReturn(Optional.of(config));
            when(executorRegistry.get(PayoutMethod.STRIPE_CONNECT)).thenReturn(executor);
            when(executor.execute(payout, config))
                    .thenThrow(new PayoutExecutionException("rejected upfront"));

            assertThatThrownBy(() -> service.executePayout(1L, 1L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("rejected upfront");
        }
    }

    @Nested
    @DisplayName("retryPayout")
    class RetryPayout {

        @Test
        @DisplayName("throws when payout not found")
        void notFound_throws() {
            when(payoutRepository.findByIdAndOrgId(1L, 1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.retryPayout(1L, 1L))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("rejects when payout is not FAILED")
        void notFailed_throws() {
            OwnerPayout payout = buildPayout(1L, PayoutStatus.PAID);
            when(payoutRepository.findByIdAndOrgId(1L, 1L)).thenReturn(Optional.of(payout));

            assertThatThrownBy(() -> service.retryPayout(1L, 1L))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("FAILED");
        }

        @Test
        @DisplayName("rejects when retry count reaches max (3)")
        void maxRetryReached_throws() {
            OwnerPayout payout = buildPayout(1L, PayoutStatus.FAILED);
            payout.setRetryCount(3);
            when(payoutRepository.findByIdAndOrgId(1L, 1L)).thenReturn(Optional.of(payout));

            assertThatThrownBy(() -> service.retryPayout(1L, 1L))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Max retry count");
        }

        @Test
        @DisplayName("resets status to APPROVED and clears failure reason then executes")
        void retry_resetsAndExecutes() {
            OwnerPayout payout = buildPayout(1L, PayoutStatus.FAILED);
            payout.setRetryCount(1);
            payout.setFailureReason("network blip");

            OwnerPayoutConfig config = buildConfig(true, PayoutMethod.STRIPE_CONNECT);

            // First findByIdAndOrgId call for retry, second for executePayout
            when(payoutRepository.findByIdAndOrgId(1L, 1L)).thenReturn(Optional.of(payout));
            when(configRepository.findByOwnerIdAndOrgId(5L, 1L)).thenReturn(Optional.of(config));
            when(executorRegistry.get(PayoutMethod.STRIPE_CONNECT)).thenReturn(executor);
            when(executor.execute(payout, config)).thenReturn(payout);

            service.retryPayout(1L, 1L);

            assertThat(payout.getStatus()).isEqualTo(PayoutStatus.PROCESSING);
            assertThat(payout.getFailureReason()).isNull();
            verify(payoutRepository).claimRetry(1L, 1L, PayoutStatus.FAILED, PayoutStatus.APPROVED);
            verify(executor).execute(payout, config);
        }
    }
}
