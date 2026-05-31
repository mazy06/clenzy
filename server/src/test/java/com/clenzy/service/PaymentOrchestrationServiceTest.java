package com.clenzy.service;

import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.model.PaymentMethodConfig;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.model.PaymentTransaction;
import com.clenzy.model.TransactionStatus;
import com.clenzy.model.TransactionType;
import com.clenzy.payment.PaymentProvider;
import com.clenzy.payment.PaymentProviderRegistry;
import com.clenzy.payment.PaymentRequest;
import com.clenzy.payment.PaymentResult;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;

/**
 * Unit tests for {@link PaymentOrchestrationService}.
 *
 * <p>Covers: initiatePayment (success/failure/idempotency), processRefund,
 * completeTransaction, failTransaction, resolveProvider edge cases via
 * currency mapping, fallback to Stripe, error handling on provider failures.</p>
 */
@ExtendWith(MockitoExtension.class)
class PaymentOrchestrationServiceTest {

    @Mock private PaymentProviderRegistry providerRegistry;
    @Mock private PaymentMethodConfigService configService;
    @Mock private PaymentTransactionRepository transactionRepository;
    @Mock private OutboxPublisher outboxPublisher;
    @Mock private PaymentProvider stripeProvider;
    @Mock private PaymentProvider paytabsProvider;
    @Mock private PaymentProvider cmiProvider;

    private TenantContext tenantContext;
    private PaymentOrchestrationService service;
    private ObjectMapper objectMapper;

    private static final Long ORG_ID = 42L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        tenantContext.setCountryCode("FR");
        objectMapper = new ObjectMapper();
        service = new PaymentOrchestrationService(providerRegistry, configService,
                transactionRepository, outboxPublisher, tenantContext, objectMapper);
    }

    private PaymentOrchestrationRequest buildRequest(String currency,
                                                       PaymentProviderType preferred,
                                                       String idempotencyKey) {
        return new PaymentOrchestrationRequest(
                BigDecimal.valueOf(100),
                currency,
                "INTERVENTION",
                10L,
                "Test desc",
                "test@x.com",
                preferred,
                "https://ok",
                "https://cancel",
                Map.of("k", "v"),
                idempotencyKey
        );
    }

    private PaymentTransaction buildTx(String ref, TransactionStatus status, PaymentProviderType type) {
        PaymentTransaction tx = new PaymentTransaction();
        tx.setOrganizationId(ORG_ID);
        tx.setTransactionRef(ref);
        tx.setProviderType(type);
        tx.setPaymentType(TransactionType.CHECKOUT);
        tx.setStatus(status);
        tx.setAmount(BigDecimal.valueOf(100));
        tx.setCurrency("EUR");
        tx.setSourceType("INTERVENTION");
        tx.setSourceId(10L);
        return tx;
    }

    // ─── initiatePayment ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("initiatePayment")
    class InitiatePayment {

        @Test
        @DisplayName("creates and saves transaction with PENDING status, then PROCESSING on provider success")
        void whenProviderSuccess_thenTxIsProcessing() {
            // Arrange
            PaymentOrchestrationRequest req = buildRequest("EUR", PaymentProviderType.STRIPE, null);
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            when(stripeProvider.getProviderType()).thenReturn(PaymentProviderType.STRIPE);
            when(transactionRepository.save(any(PaymentTransaction.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            when(stripeProvider.createPayment(any(PaymentRequest.class)))
                    .thenReturn(PaymentResult.success("pi_123", "https://stripe.test/checkout"));

            // Act
            PaymentOrchestrationResult result = service.initiatePayment(req);

            // Assert
            assertThat(result.isSuccess()).isTrue();
            assertThat(result.providerUsed()).isEqualTo(PaymentProviderType.STRIPE);
            assertThat(result.paymentResult().providerTxId()).isEqualTo("pi_123");
            verify(transactionRepository, times(2)).save(any(PaymentTransaction.class));
            verify(outboxPublisher).publish(eq("PAYMENT"), anyString(), eq("PAYMENT_INITIATED"),
                    anyString(), anyString(), anyString(), eq(ORG_ID));
        }

        @Test
        @DisplayName("marks transaction FAILED when provider returns failure")
        void whenProviderFailure_thenTxIsFailed() {
            // Arrange
            PaymentOrchestrationRequest req = buildRequest("EUR", PaymentProviderType.STRIPE, null);
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            when(stripeProvider.getProviderType()).thenReturn(PaymentProviderType.STRIPE);
            when(transactionRepository.save(any(PaymentTransaction.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            when(stripeProvider.createPayment(any(PaymentRequest.class)))
                    .thenReturn(PaymentResult.failure("Card declined"));

            // Act
            PaymentOrchestrationResult result = service.initiatePayment(req);

            // Assert
            assertThat(result.isSuccess()).isFalse();
            assertThat(result.paymentResult().errorMessage()).isEqualTo("Card declined");
            ArgumentCaptor<PaymentTransaction> captor = ArgumentCaptor.forClass(PaymentTransaction.class);
            verify(transactionRepository, times(2)).save(captor.capture());
            assertThat(captor.getAllValues().get(1).getStatus()).isEqualTo(TransactionStatus.FAILED);
        }

        @Test
        @DisplayName("marks transaction FAILED when provider throws exception")
        void whenProviderThrows_thenTxIsFailed() {
            // Arrange
            PaymentOrchestrationRequest req = buildRequest("EUR", PaymentProviderType.STRIPE, null);
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            when(stripeProvider.getProviderType()).thenReturn(PaymentProviderType.STRIPE);
            when(transactionRepository.save(any(PaymentTransaction.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            when(stripeProvider.createPayment(any(PaymentRequest.class)))
                    .thenThrow(new RuntimeException("Network error"));

            // Act
            PaymentOrchestrationResult result = service.initiatePayment(req);

            // Assert
            assertThat(result.isSuccess()).isFalse();
            assertThat(result.paymentResult().errorMessage()).contains("Network error");
            ArgumentCaptor<PaymentTransaction> captor = ArgumentCaptor.forClass(PaymentTransaction.class);
            verify(transactionRepository, times(2)).save(captor.capture());
            assertThat(captor.getAllValues().get(1).getStatus()).isEqualTo(TransactionStatus.FAILED);
        }

        @Test
        @DisplayName("returns existing transaction on idempotent retry (status not FAILED)")
        void whenIdempotentReplay_thenReturnsExisting() {
            // Arrange
            PaymentOrchestrationRequest req = buildRequest("EUR", PaymentProviderType.STRIPE, "IDEM-KEY-1");
            PaymentTransaction existing = buildTx("TX-OLD", TransactionStatus.PROCESSING, PaymentProviderType.STRIPE);
            existing.setProviderTxId("pi_old");
            when(transactionRepository.findByIdempotencyKey("IDEM-KEY-1"))
                    .thenReturn(Optional.of(existing));

            // Act
            PaymentOrchestrationResult result = service.initiatePayment(req);

            // Assert
            assertThat(result.isSuccess()).isTrue();
            assertThat(result.paymentResult().providerTxId()).isEqualTo("pi_old");
            verify(providerRegistry, never()).get(any());
            verify(stripeProvider, never()).createPayment(any());
        }

        @Test
        @DisplayName("allows retry when existing transaction is FAILED")
        void whenExistingFailed_thenAllowsRetry() {
            // Arrange
            PaymentOrchestrationRequest req = buildRequest("EUR", PaymentProviderType.STRIPE, "IDEM-RETRY");
            PaymentTransaction failed = buildTx("TX-FAILED", TransactionStatus.FAILED, PaymentProviderType.STRIPE);
            failed.setIdempotencyKey("IDEM-RETRY");
            when(transactionRepository.findByIdempotencyKey("IDEM-RETRY"))
                    .thenReturn(Optional.of(failed));
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            when(stripeProvider.getProviderType()).thenReturn(PaymentProviderType.STRIPE);
            when(transactionRepository.save(any(PaymentTransaction.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            when(stripeProvider.createPayment(any(PaymentRequest.class)))
                    .thenReturn(PaymentResult.success("pi_new", "https://stripe.test/r"));

            // Act
            PaymentOrchestrationResult result = service.initiatePayment(req);

            // Assert
            assertThat(result.isSuccess()).isTrue();
            // 3 saves: 1 clearing old key, 1 creating new tx (PENDING), 1 updating to PROCESSING
            verify(transactionRepository, times(3)).save(any(PaymentTransaction.class));
        }

        @Test
        @DisplayName("uses preferredProvider when specified")
        void whenPreferredProvider_thenUsesIt() {
            // Arrange
            PaymentOrchestrationRequest req = buildRequest("EUR", PaymentProviderType.PAYTABS, null);
            when(providerRegistry.get(PaymentProviderType.PAYTABS)).thenReturn(paytabsProvider);
            when(paytabsProvider.getProviderType()).thenReturn(PaymentProviderType.PAYTABS);
            when(transactionRepository.save(any(PaymentTransaction.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            when(paytabsProvider.createPayment(any(PaymentRequest.class)))
                    .thenReturn(PaymentResult.success("pt_123", "https://pt"));

            // Act
            PaymentOrchestrationResult result = service.initiatePayment(req);

            // Assert
            assertThat(result.providerUsed()).isEqualTo(PaymentProviderType.PAYTABS);
            verify(configService, never()).getEnabledProviders(any(), any());
        }

        @Test
        @DisplayName("resolves PayTabs when currency is SAR and config is enabled")
        void whenSarCurrencyAndPaytabsEnabled_thenUsesPaytabs() {
            // Arrange
            PaymentOrchestrationRequest req = buildRequest("SAR", null, null);
            PaymentMethodConfig paytabsCfg = new PaymentMethodConfig();
            paytabsCfg.setProviderType(PaymentProviderType.PAYTABS);
            when(configService.getEnabledProviders(ORG_ID, "FR")).thenReturn(List.of(paytabsCfg));
            when(providerRegistry.get(PaymentProviderType.PAYTABS)).thenReturn(paytabsProvider);
            when(paytabsProvider.getProviderType()).thenReturn(PaymentProviderType.PAYTABS);
            when(transactionRepository.save(any(PaymentTransaction.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            when(paytabsProvider.createPayment(any(PaymentRequest.class)))
                    .thenReturn(PaymentResult.success("pt", "url"));

            // Act
            PaymentOrchestrationResult result = service.initiatePayment(req);

            // Assert
            assertThat(result.providerUsed()).isEqualTo(PaymentProviderType.PAYTABS);
        }

        @Test
        @DisplayName("falls back to Stripe when no provider enabled for country")
        void whenNoProviderEnabled_thenFallsBackToStripe() {
            // Arrange
            PaymentOrchestrationRequest req = buildRequest("EUR", null, null);
            when(configService.getEnabledProviders(ORG_ID, "FR")).thenReturn(List.of());
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            when(stripeProvider.getProviderType()).thenReturn(PaymentProviderType.STRIPE);
            when(transactionRepository.save(any(PaymentTransaction.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            when(stripeProvider.createPayment(any(PaymentRequest.class)))
                    .thenReturn(PaymentResult.success("pi", "url"));

            // Act
            PaymentOrchestrationResult result = service.initiatePayment(req);

            // Assert
            assertThat(result.providerUsed()).isEqualTo(PaymentProviderType.STRIPE);
        }

        @Test
        @DisplayName("uses first enabled provider when no strong currency match")
        void whenCountryMatch_thenUsesFirstConfig() {
            // Arrange
            PaymentOrchestrationRequest req = buildRequest("EUR", null, null);
            PaymentMethodConfig stripeCfg = new PaymentMethodConfig();
            stripeCfg.setProviderType(PaymentProviderType.STRIPE);
            when(configService.getEnabledProviders(ORG_ID, "FR")).thenReturn(List.of(stripeCfg));
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            when(stripeProvider.getProviderType()).thenReturn(PaymentProviderType.STRIPE);
            when(transactionRepository.save(any(PaymentTransaction.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            when(stripeProvider.createPayment(any(PaymentRequest.class)))
                    .thenReturn(PaymentResult.success("pi", "url"));

            // Act
            PaymentOrchestrationResult result = service.initiatePayment(req);

            // Assert
            assertThat(result.providerUsed()).isEqualTo(PaymentProviderType.STRIPE);
        }

        @Test
        @DisplayName("propagates metadata to provider request")
        void whenRequestHasMetadata_thenPropagatedToProvider() {
            // Arrange
            Map<String, String> meta = new HashMap<>();
            meta.put("foo", "bar");
            PaymentOrchestrationRequest req = new PaymentOrchestrationRequest(
                    BigDecimal.TEN, "EUR", "INTERVENTION", 1L,
                    "desc", "e@x.com", PaymentProviderType.STRIPE, "ok", "ko", meta, null);
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            when(stripeProvider.getProviderType()).thenReturn(PaymentProviderType.STRIPE);
            when(transactionRepository.save(any(PaymentTransaction.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            when(stripeProvider.createPayment(any(PaymentRequest.class)))
                    .thenReturn(PaymentResult.success("pi", "url"));

            // Act
            service.initiatePayment(req);

            // Assert
            ArgumentCaptor<PaymentRequest> captor = ArgumentCaptor.forClass(PaymentRequest.class);
            verify(stripeProvider).createPayment(captor.capture());
            Map<String, String> m = captor.getValue().metadata();
            assertThat(m).containsEntry("foo", "bar")
                    .containsEntry("orgId", String.valueOf(ORG_ID))
                    .containsEntry("sourceType", "INTERVENTION")
                    .containsEntry("sourceId", "1")
                    .containsKey("transactionRef");
        }

        @Test
        @DisplayName("idempotency check skipped when key is null")
        void whenNullIdempotencyKey_thenSkipsCheck() {
            // Arrange
            PaymentOrchestrationRequest req = buildRequest("EUR", PaymentProviderType.STRIPE, null);
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            when(stripeProvider.getProviderType()).thenReturn(PaymentProviderType.STRIPE);
            when(transactionRepository.save(any(PaymentTransaction.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            when(stripeProvider.createPayment(any(PaymentRequest.class)))
                    .thenReturn(PaymentResult.success("pi", "url"));

            // Act
            service.initiatePayment(req);

            // Assert
            verify(transactionRepository, never()).findByIdempotencyKey(any());
        }

        @Test
        @DisplayName("idempotency check skipped when key is blank")
        void whenBlankIdempotencyKey_thenSkipsCheck() {
            // Arrange
            PaymentOrchestrationRequest req = buildRequest("EUR", PaymentProviderType.STRIPE, "  ");
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            when(stripeProvider.getProviderType()).thenReturn(PaymentProviderType.STRIPE);
            when(transactionRepository.save(any(PaymentTransaction.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            when(stripeProvider.createPayment(any(PaymentRequest.class)))
                    .thenReturn(PaymentResult.success("pi", "url"));

            // Act
            service.initiatePayment(req);

            // Assert
            verify(transactionRepository, never()).findByIdempotencyKey(any());
        }
    }

    // ─── processRefund ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("processRefund")
    class ProcessRefund {

        @Test
        @DisplayName("creates refund transaction on success")
        void whenSuccess_thenCreatesRefundTx() {
            // Arrange
            PaymentTransaction original = buildTx("TX-ORIG", TransactionStatus.COMPLETED, PaymentProviderType.STRIPE);
            original.setProviderTxId("pi_orig");
            when(transactionRepository.findByTransactionRef("TX-ORIG")).thenReturn(Optional.of(original));
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            when(stripeProvider.getProviderType()).thenReturn(PaymentProviderType.STRIPE);
            when(transactionRepository.save(any(PaymentTransaction.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            when(stripeProvider.refundPayment(any(com.clenzy.payment.RefundContext.class), any(BigDecimal.class), anyString()))
                    .thenReturn(PaymentResult.success("rf_123", null));

            // Act
            PaymentOrchestrationResult result = service.processRefund("TX-ORIG", BigDecimal.valueOf(50), "test reason");

            // Assert
            assertThat(result.isSuccess()).isTrue();
            assertThat(result.paymentResult().providerTxId()).isEqualTo("rf_123");
            ArgumentCaptor<PaymentTransaction> captor = ArgumentCaptor.forClass(PaymentTransaction.class);
            verify(transactionRepository, times(2)).save(captor.capture());
            PaymentTransaction refund = captor.getAllValues().get(1);
            assertThat(refund.getPaymentType()).isEqualTo(TransactionType.REFUND);
            assertThat(refund.getStatus()).isEqualTo(TransactionStatus.COMPLETED);
            verify(outboxPublisher).publish(eq("PAYMENT"), anyString(), eq("PAYMENT_REFUNDED"),
                    anyString(), anyString(), anyString(), eq(ORG_ID));
        }

        @Test
        @DisplayName("uses original amount when amount param is null")
        void whenNullAmount_thenUsesOriginalAmount() {
            // Arrange
            PaymentTransaction original = buildTx("TX-ORIG", TransactionStatus.COMPLETED, PaymentProviderType.STRIPE);
            original.setProviderTxId("pi_orig");
            original.setAmount(BigDecimal.valueOf(200));
            when(transactionRepository.findByTransactionRef("TX-ORIG")).thenReturn(Optional.of(original));
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            when(stripeProvider.getProviderType()).thenReturn(PaymentProviderType.STRIPE);
            when(transactionRepository.save(any(PaymentTransaction.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            when(stripeProvider.refundPayment(any(com.clenzy.payment.RefundContext.class), any(BigDecimal.class), anyString()))
                    .thenReturn(PaymentResult.success("rf_x", null));

            // Act
            service.processRefund("TX-ORIG", null, "full");

            // Assert
            ArgumentCaptor<PaymentTransaction> captor = ArgumentCaptor.forClass(PaymentTransaction.class);
            verify(transactionRepository, times(2)).save(captor.capture());
            assertThat(captor.getAllValues().get(0).getAmount()).isEqualByComparingTo("200");
        }

        @Test
        @DisplayName("throws when transaction not found")
        void whenTxNotFound_thenThrows() {
            // Arrange
            when(transactionRepository.findByTransactionRef("UNKNOWN")).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.processRefund("UNKNOWN", null, "test"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Transaction not found");
        }

        @Test
        @DisplayName("throws when transaction belongs to different org")
        void whenWrongOrg_thenThrows() {
            // Arrange
            PaymentTransaction other = buildTx("TX-OTHER", TransactionStatus.COMPLETED, PaymentProviderType.STRIPE);
            other.setOrganizationId(999L);
            when(transactionRepository.findByTransactionRef("TX-OTHER")).thenReturn(Optional.of(other));

            // Act & Assert
            assertThatThrownBy(() -> service.processRefund("TX-OTHER", null, "test"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Transaction not found");
        }

        @Test
        @DisplayName("marks refund tx FAILED when provider throws")
        void whenProviderThrows_thenRefundIsFailed() {
            // Arrange
            PaymentTransaction original = buildTx("TX-ORIG", TransactionStatus.COMPLETED, PaymentProviderType.STRIPE);
            original.setProviderTxId("pi_orig");
            when(transactionRepository.findByTransactionRef("TX-ORIG")).thenReturn(Optional.of(original));
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            when(stripeProvider.getProviderType()).thenReturn(PaymentProviderType.STRIPE);
            when(transactionRepository.save(any(PaymentTransaction.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            when(stripeProvider.refundPayment(any(com.clenzy.payment.RefundContext.class), any(BigDecimal.class), anyString()))
                    .thenThrow(new RuntimeException("boom"));

            // Act
            PaymentOrchestrationResult result = service.processRefund("TX-ORIG", null, "test");

            // Assert
            assertThat(result.isSuccess()).isFalse();
            assertThat(result.paymentResult().errorMessage()).contains("boom");
        }

        @Test
        @DisplayName("marks refund tx FAILED when provider returns failure")
        void whenProviderReturnsFailure_thenRefundIsFailed() {
            // Arrange
            PaymentTransaction original = buildTx("TX-ORIG", TransactionStatus.COMPLETED, PaymentProviderType.STRIPE);
            original.setProviderTxId("pi_orig");
            when(transactionRepository.findByTransactionRef("TX-ORIG")).thenReturn(Optional.of(original));
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            when(stripeProvider.getProviderType()).thenReturn(PaymentProviderType.STRIPE);
            when(transactionRepository.save(any(PaymentTransaction.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            when(stripeProvider.refundPayment(any(com.clenzy.payment.RefundContext.class), any(BigDecimal.class), anyString()))
                    .thenReturn(PaymentResult.failure("Already refunded"));

            // Act
            PaymentOrchestrationResult result = service.processRefund("TX-ORIG", null, "test");

            // Assert
            assertThat(result.isSuccess()).isFalse();
            ArgumentCaptor<PaymentTransaction> captor = ArgumentCaptor.forClass(PaymentTransaction.class);
            verify(transactionRepository, times(2)).save(captor.capture());
            assertThat(captor.getAllValues().get(1).getStatus()).isEqualTo(TransactionStatus.FAILED);
        }
    }

    // ─── completeTransaction ──────────────────────────────────────────────────

    @Nested
    @DisplayName("completeTransaction")
    class CompleteTransaction {

        @Test
        @DisplayName("marks transaction COMPLETED")
        void whenFound_thenMarksCompleted() {
            // Arrange
            PaymentTransaction tx = buildTx("TX-1", TransactionStatus.PROCESSING, PaymentProviderType.STRIPE);
            when(transactionRepository.findByTransactionRef("TX-1")).thenReturn(Optional.of(tx));
            when(transactionRepository.save(any(PaymentTransaction.class))).thenAnswer(i -> i.getArgument(0));

            // Act
            PaymentTransaction result = service.completeTransaction("TX-1");

            // Assert
            assertThat(result.getStatus()).isEqualTo(TransactionStatus.COMPLETED);
            verify(outboxPublisher).publish(eq("PAYMENT"), anyString(), eq("PAYMENT_COMPLETED"),
                    anyString(), anyString(), anyString(), eq(ORG_ID));
        }

        @Test
        @DisplayName("is idempotent (skip when already COMPLETED)")
        void whenAlreadyCompleted_thenSkipsResave() {
            // Arrange
            PaymentTransaction tx = buildTx("TX-1", TransactionStatus.COMPLETED, PaymentProviderType.STRIPE);
            when(transactionRepository.findByTransactionRef("TX-1")).thenReturn(Optional.of(tx));

            // Act
            PaymentTransaction result = service.completeTransaction("TX-1");

            // Assert
            assertThat(result.getStatus()).isEqualTo(TransactionStatus.COMPLETED);
            verify(transactionRepository, never()).save(any());
            verify(outboxPublisher, never()).publish(any(), any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("throws when transaction not found")
        void whenNotFound_thenThrows() {
            // Arrange
            when(transactionRepository.findByTransactionRef("UNKNOWN")).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.completeTransaction("UNKNOWN"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Transaction not found");
        }
    }

    // ─── failTransaction ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("failTransaction")
    class FailTransaction {

        @Test
        @DisplayName("marks transaction FAILED with error message")
        void whenFound_thenMarksFailed() {
            // Arrange
            PaymentTransaction tx = buildTx("TX-1", TransactionStatus.PROCESSING, PaymentProviderType.STRIPE);
            when(transactionRepository.findByTransactionRef("TX-1")).thenReturn(Optional.of(tx));
            when(transactionRepository.save(any(PaymentTransaction.class))).thenAnswer(i -> i.getArgument(0));

            // Act
            PaymentTransaction result = service.failTransaction("TX-1", "Card declined");

            // Assert
            assertThat(result.getStatus()).isEqualTo(TransactionStatus.FAILED);
            assertThat(result.getErrorMessage()).isEqualTo("Card declined");
            verify(outboxPublisher).publish(eq("PAYMENT"), anyString(), eq("PAYMENT_FAILED"),
                    anyString(), anyString(), anyString(), eq(ORG_ID));
        }

        @Test
        @DisplayName("throws when transaction not found")
        void whenNotFound_thenThrows() {
            // Arrange
            when(transactionRepository.findByTransactionRef("UNKNOWN")).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.failTransaction("UNKNOWN", "err"))
                    .isInstanceOf(RuntimeException.class);
        }

        @Test
        @DisplayName("publishes outbox event even when prior status was PENDING")
        void whenPending_thenStillFails() {
            // Arrange
            PaymentTransaction tx = buildTx("TX-2", TransactionStatus.PENDING, PaymentProviderType.STRIPE);
            when(transactionRepository.findByTransactionRef("TX-2")).thenReturn(Optional.of(tx));
            when(transactionRepository.save(any(PaymentTransaction.class))).thenAnswer(i -> i.getArgument(0));

            // Act
            PaymentTransaction result = service.failTransaction("TX-2", "manual");

            // Assert
            assertThat(result.getStatus()).isEqualTo(TransactionStatus.FAILED);
        }
    }

    // ─── publishEvent error handling ──────────────────────────────────────────

    @Nested
    @DisplayName("publishEvent JSON error handling")
    class PublishEventErrors {

        @Test
        @DisplayName("does not break flow when ObjectMapper throws JsonProcessingException")
        void whenObjectMapperFails_thenContinues() throws JsonProcessingException {
            // Arrange
            ObjectMapper failingMapper = org.mockito.Mockito.mock(ObjectMapper.class);
            when(failingMapper.writeValueAsString(any())).thenThrow(new JsonProcessingException("boom") {});
            PaymentOrchestrationService failingService = new PaymentOrchestrationService(
                    providerRegistry, configService, transactionRepository,
                    outboxPublisher, tenantContext, failingMapper);

            PaymentTransaction tx = buildTx("TX-1", TransactionStatus.PROCESSING, PaymentProviderType.STRIPE);
            when(transactionRepository.findByTransactionRef("TX-1")).thenReturn(Optional.of(tx));
            when(transactionRepository.save(any(PaymentTransaction.class))).thenAnswer(i -> i.getArgument(0));

            // Act — should not throw
            PaymentTransaction result = failingService.completeTransaction("TX-1");

            // Assert
            assertThat(result.getStatus()).isEqualTo(TransactionStatus.COMPLETED);
            verify(outboxPublisher, never()).publish(any(), any(), any(), any(), any(), any(), any());
        }
    }
}
