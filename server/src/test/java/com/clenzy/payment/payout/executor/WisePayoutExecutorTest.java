package com.clenzy.payment.payout.executor;

import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import com.clenzy.model.User;
import com.clenzy.payment.payout.PayoutExecutor;
import com.clenzy.payment.payout.PayoutNotifier;
import com.clenzy.payment.payout.wise.WiseClient;
import com.clenzy.repository.OwnerPayoutConfigRepository;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link WisePayoutExecutor}.
 *
 * <h2>Focus</h2>
 * <ul>
 *   <li>Validation des préconditions (Wise enabled, IBAN présent)</li>
 *   <li>Idempotence de la création de recipient (réutilisation si déjà existant)</li>
 *   <li>Enchaînement quote → transfer → fund</li>
 *   <li>Statut PROCESSING en sortie (le PAID arrive via webhook async)</li>
 *   <li>Gestion d'erreur API → FAILED</li>
 * </ul>
 */
class WisePayoutExecutorTest {

    private WiseClient wiseClient;
    private OwnerPayoutRepository payoutRepository;
    private OwnerPayoutConfigRepository configRepository;
    private UserRepository userRepository;
    private PayoutNotifier notifier;
    private WisePayoutExecutor executor;

    @BeforeEach
    void setUp() {
        wiseClient = mock(WiseClient.class);
        payoutRepository = mock(OwnerPayoutRepository.class);
        configRepository = mock(OwnerPayoutConfigRepository.class);
        userRepository = mock(UserRepository.class);
        notifier = mock(PayoutNotifier.class);
        executor = new WisePayoutExecutor(wiseClient, payoutRepository, configRepository,
            userRepository, notifier);

        // Default : save renvoie l'argument (comportement JPA classique)
        when(payoutRepository.save(any(OwnerPayout.class))).thenAnswer(inv -> inv.getArgument(0));
        when(configRepository.save(any(OwnerPayoutConfig.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    @DisplayName("getSupportedMethod returns WISE")
    void supportedMethod_isWise() {
        assertThat(executor.getSupportedMethod()).isEqualTo(PayoutMethod.WISE);
    }

    // ─── Préconditions ────────────────────────────────────────────────────

    @Test
    @DisplayName("execute refuse si Wise n'est pas configuré côté Clenzy")
    void execute_wiseDisabled_throws() {
        when(wiseClient.isEnabled()).thenReturn(false);
        OwnerPayout payout = buildPayout();
        OwnerPayoutConfig config = buildConfig("FR7612345...");

        assertThatThrownBy(() -> executor.execute(payout, config))
            .isInstanceOf(PayoutExecutor.PayoutExecutionException.class)
            .hasMessageContaining("Wise n'est pas configure");
    }

    @Test
    @DisplayName("execute refuse si IBAN absent du config")
    void execute_missingIban_throws() {
        when(wiseClient.isEnabled()).thenReturn(true);
        OwnerPayout payout = buildPayout();
        OwnerPayoutConfig config = buildConfig(null);

        assertThatThrownBy(() -> executor.execute(payout, config))
            .isInstanceOf(PayoutExecutor.PayoutExecutionException.class)
            .hasMessageContaining("IBAN");
    }

    // ─── Flow nominal ──────────────────────────────────────────────────────

    @Test
    @DisplayName("Nominal : crée recipient si absent, quote, transfer, fund → PROCESSING")
    void execute_nominalFlow_leavesProcessing() {
        when(wiseClient.isEnabled()).thenReturn(true);
        when(wiseClient.createRecipient(anyString(), anyString(), anyString(), anyString()))
            .thenReturn("WISE-REC-001");
        when(wiseClient.createQuote(any(), anyString(), anyString(), anyString()))
            .thenReturn(new WiseClient.WiseQuote("QUOTE-XYZ",
                new BigDecimal("2700.50"), new BigDecimal("4.20")));
        when(wiseClient.createTransfer(anyString(), anyString(), anyLong(), anyString()))
            .thenReturn("123456789");

        User owner = new User();
        owner.setFirstName("Mohammed");
        owner.setLastName("Alami");
        when(userRepository.findById(anyLong())).thenReturn(Optional.of(owner));

        OwnerPayout payout = buildPayout();
        OwnerPayoutConfig config = buildConfig("MA640000000000000000000123");
        // Pas de recipientId persisté → premier payout

        OwnerPayout result = executor.execute(payout, config);

        assertThat(result.getStatus()).isEqualTo(PayoutStatus.PROCESSING);
        assertThat(result.getPayoutMethod()).isEqualTo(PayoutMethod.WISE);
        assertThat(result.getPaymentReference()).isEqualTo("WISE:123456789");
        verify(wiseClient).fundTransfer("123456789");
        // Le recipient est persisté dans config
        assertThat(config.getWiseRecipientId()).isEqualTo("WISE-REC-001");
        // Pas de notification de succès (PROCESSING, pas PAID — le webhook viendra)
        verify(notifier, never()).notifySuccess(any());
    }

    @Test
    @DisplayName("Recipient déjà en config : pas de nouvel appel createRecipient")
    void execute_recipientAlreadyExists_skipsCreation() {
        when(wiseClient.isEnabled()).thenReturn(true);
        when(wiseClient.createQuote(any(), anyString(), anyString(), anyString()))
            .thenReturn(new WiseClient.WiseQuote("Q", BigDecimal.TEN, BigDecimal.ZERO));
        when(wiseClient.createTransfer(anyString(), anyString(), anyLong(), anyString()))
            .thenReturn("999");

        OwnerPayout payout = buildPayout();
        OwnerPayoutConfig config = buildConfig("MA640000000000000000000123");
        config.setWiseRecipientId("WISE-REC-EXISTING");

        executor.execute(payout, config);

        verify(wiseClient, never()).createRecipient(anyString(), anyString(), anyString(), anyString());
    }

    // ─── Gestion d'erreur ─────────────────────────────────────────────────

    @Test
    @DisplayName("Erreur API Wise → payout FAILED + notification")
    void execute_apiError_marksFailed() {
        when(wiseClient.isEnabled()).thenReturn(true);
        when(wiseClient.createRecipient(anyString(), anyString(), anyString(), anyString()))
            .thenReturn("WISE-REC-001");
        when(wiseClient.createQuote(any(), anyString(), anyString(), anyString()))
            .thenThrow(new WiseClient.WiseApiException("Quote refused: insufficient balance"));

        when(userRepository.findById(anyLong())).thenReturn(Optional.of(new User()));

        OwnerPayout payout = buildPayout();
        OwnerPayoutConfig config = buildConfig("MA640000000000000000000123");

        OwnerPayout result = executor.execute(payout, config);

        assertThat(result.getStatus()).isEqualTo(PayoutStatus.FAILED);
        assertThat(result.getFailureReason()).contains("insufficient balance");
        assertThat(result.getRetryCount()).isEqualTo(1);
        verify(notifier).notifyFailure(eq(result), anyString());
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    private OwnerPayout buildPayout() {
        OwnerPayout p = new OwnerPayout();
        p.setId(42L);
        p.setOwnerId(7L);
        p.setOrganizationId(1L);
        p.setStatus(PayoutStatus.APPROVED);
        p.setNetAmount(new BigDecimal("2500.00"));
        p.setCurrency("MAD");
        p.setPeriodStart(LocalDate.of(2026, 5, 1));
        p.setPeriodEnd(LocalDate.of(2026, 5, 31));
        return p;
    }

    private OwnerPayoutConfig buildConfig(String iban) {
        OwnerPayoutConfig c = new OwnerPayoutConfig();
        c.setOwnerId(7L);
        c.setOrganizationId(1L);
        c.setPayoutMethod(PayoutMethod.WISE);
        c.setIban(iban);
        c.setBankAccountHolder("Mohammed Alami");
        c.setVerified(true);
        return c;
    }
}
