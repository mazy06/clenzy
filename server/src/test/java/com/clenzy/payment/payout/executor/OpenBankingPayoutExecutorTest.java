package com.clenzy.payment.payout.executor;

import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import com.clenzy.payment.payout.PayoutExecutor;
import com.clenzy.payment.payout.PayoutNotifier;
import com.clenzy.payment.payout.openbanking.GoCardlessPisClient;
import com.clenzy.repository.OwnerPayoutRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OpenBankingPayoutExecutorTest {

    private GoCardlessPisClient client;
    private OwnerPayoutRepository payoutRepository;
    private PayoutNotifier notifier;
    private OpenBankingPayoutExecutor executor;

    @BeforeEach
    void setUp() {
        client = mock(GoCardlessPisClient.class);
        payoutRepository = mock(OwnerPayoutRepository.class);
        notifier = mock(PayoutNotifier.class);
        executor = new OpenBankingPayoutExecutor(client, payoutRepository, notifier);

        when(payoutRepository.save(any(OwnerPayout.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    @DisplayName("supportedMethod = OPEN_BANKING")
    void supportedMethod() {
        assertThat(executor.getSupportedMethod()).isEqualTo(PayoutMethod.OPEN_BANKING);
    }

    @Test
    @DisplayName("execute refuse si GoCardless n'est pas configuré")
    void execute_disabled_throws() {
        when(client.isEnabled()).thenReturn(false);
        assertThatThrownBy(() -> executor.execute(buildPayout(), buildConfig(true, true)))
            .isInstanceOf(PayoutExecutor.PayoutExecutionException.class)
            .hasMessageContaining("Open Banking n'est pas configure");
    }

    @Test
    @DisplayName("execute refuse si consent absent")
    void execute_noConsent_throws() {
        when(client.isEnabled()).thenReturn(true);
        OwnerPayoutConfig config = buildConfig(true, true);
        config.setOpenBankingConsentId(null);
        assertThatThrownBy(() -> executor.execute(buildPayout(), config))
            .isInstanceOf(PayoutExecutor.PayoutExecutionException.class)
            .hasMessageContaining("SCA");
    }

    @Test
    @DisplayName("execute refuse si consent expiré")
    void execute_expiredConsent_throws() {
        when(client.isEnabled()).thenReturn(true);
        OwnerPayoutConfig config = buildConfig(true, true);
        config.setOpenBankingConsentExpiresAt(Instant.now().minus(1, ChronoUnit.DAYS));
        assertThatThrownBy(() -> executor.execute(buildPayout(), config))
            .isInstanceOf(PayoutExecutor.PayoutExecutionException.class)
            .hasMessageContaining("expire");
    }

    @Test
    @DisplayName("execute refuse si provider non GOCARDLESS (MVP)")
    void execute_nonGocardlessProvider_throws() {
        when(client.isEnabled()).thenReturn(true);
        OwnerPayoutConfig config = buildConfig(true, true);
        config.setOpenBankingProvider("TINK");
        assertThatThrownBy(() -> executor.execute(buildPayout(), config))
            .isInstanceOf(PayoutExecutor.PayoutExecutionException.class)
            .hasMessageContaining("TINK")
            .hasMessageContaining("GOCARDLESS");
    }

    @Test
    @DisplayName("execute refuse si provider inconnu")
    void execute_unknownProvider_throws() {
        when(client.isEnabled()).thenReturn(true);
        OwnerPayoutConfig config = buildConfig(true, true);
        config.setOpenBankingProvider("UNKNOWN_PIS");
        assertThatThrownBy(() -> executor.execute(buildPayout(), config))
            .isInstanceOf(PayoutExecutor.PayoutExecutionException.class)
            .hasMessageContaining("inconnu");
    }

    @Test
    @DisplayName("execute refuse si IBAN absent")
    void execute_noIban_throws() {
        when(client.isEnabled()).thenReturn(true);
        OwnerPayoutConfig config = buildConfig(true, false);
        assertThatThrownBy(() -> executor.execute(buildPayout(), config))
            .isInstanceOf(PayoutExecutor.PayoutExecutionException.class)
            .hasMessageContaining("IBAN");
    }

    @Test
    @DisplayName("Nominal : initie payment GoCardless → PROCESSING")
    void execute_nominal_leavesProcessing() {
        when(client.isEnabled()).thenReturn(true);
        when(client.initiatePayment(anyString(), any(), anyString(), anyString(), anyString(), anyString()))
            .thenReturn("GCP-12345");

        OwnerPayout result = executor.execute(buildPayout(), buildConfig(true, true));

        assertThat(result.getStatus()).isEqualTo(PayoutStatus.PROCESSING);
        assertThat(result.getPaymentReference()).isEqualTo("GOCARDLESS:GCP-12345");
        assertThat(result.getPayoutMethod()).isEqualTo(PayoutMethod.OPEN_BANKING);
    }

    @Test
    @DisplayName("API GoCardless en erreur → FAILED + notification")
    void execute_apiError_marksFailed() {
        when(client.isEnabled()).thenReturn(true);
        when(client.initiatePayment(anyString(), any(), anyString(), anyString(), anyString(), anyString()))
            .thenThrow(new GoCardlessPisClient.OpenBankingApiException("Insufficient balance"));

        OwnerPayout result = executor.execute(buildPayout(), buildConfig(true, true));

        assertThat(result.getStatus()).isEqualTo(PayoutStatus.FAILED);
        assertThat(result.getFailureReason()).contains("Insufficient balance");
        verify(notifier).notifyFailure(any(), anyString());
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    private OwnerPayout buildPayout() {
        OwnerPayout p = new OwnerPayout();
        p.setId(42L);
        p.setOwnerId(7L);
        p.setOrganizationId(1L);
        p.setStatus(PayoutStatus.APPROVED);
        p.setNetAmount(new BigDecimal("1500.00"));
        p.setCurrency("EUR");
        p.setPeriodStart(LocalDate.of(2026, 5, 1));
        p.setPeriodEnd(LocalDate.of(2026, 5, 31));
        return p;
    }

    private OwnerPayoutConfig buildConfig(boolean withConsent, boolean withIban) {
        OwnerPayoutConfig c = new OwnerPayoutConfig();
        c.setOrganizationId(1L);
        c.setOwnerId(7L);
        c.setPayoutMethod(PayoutMethod.OPEN_BANKING);
        c.setVerified(true);
        c.setBankAccountHolder("Jean Dupont");
        c.setOpenBankingProvider("GOCARDLESS");
        if (withConsent) {
            c.setOpenBankingConsentId("REQ-ABC-001");
            c.setOpenBankingConsentExpiresAt(Instant.now().plus(60, ChronoUnit.DAYS));
        }
        if (withIban) {
            c.setIban("FR7612345678901234567890123");
        }
        return c;
    }
}
