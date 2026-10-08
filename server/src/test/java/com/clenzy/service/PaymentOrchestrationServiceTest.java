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
import com.clenzy.payment.RefundContext;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests d'orchestration de {@link PaymentOrchestrationService}.
 *
 * <p>La persistance (écritures DB + outbox) est déléguée à
 * {@link PaymentPersistence} (mocké ici) et testée dans
 * {@code PaymentPersistenceTest}. Ce test couvre : idempotence (court-circuit),
 * résolution du provider (preferred / devise / pays / fallback), appel externe
 * hors transaction, et gestion d'erreur.</p>
 */
@ExtendWith(MockitoExtension.class)
class PaymentOrchestrationServiceTest {

    @Mock private PaymentProviderRegistry providerRegistry;
    @Mock private PaymentMethodConfigService configService;
    @Mock private PaymentPersistence paymentPersistence;
    @Mock private PaymentProvider stripeProvider;
    @Mock private PaymentProvider paytabsProvider;

    private TenantContext tenantContext;
    private PaymentOrchestrationService service;

    private static final Long ORG_ID = 42L;

    @Test
    void refundFallbackPreservesBusinessRejectionWithoutCallingProvider() {
        var rejection = new com.clenzy.exception.PaymentValidationException("Remboursement déjà à rapprocher");
        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
                org.springframework.test.util.ReflectionTestUtils.invokeMethod(service,
                        "processRefundFallback", "TX-ORIG", new BigDecimal("35"), "Test", rejection))
                .isSameAs(rejection);
        org.mockito.Mockito.verifyNoInteractions(providerRegistry, paymentPersistence);
    }

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        tenantContext.setCountryCode("FR");
        service = new PaymentOrchestrationService(providerRegistry, configService,
                paymentPersistence, tenantContext);
    }

    private PaymentOrchestrationRequest buildRequest(String currency,
                                                       PaymentProviderType preferred,
                                                       String idempotencyKey) {
        return new PaymentOrchestrationRequest(
                BigDecimal.valueOf(100), currency, "INTERVENTION", 10L,
                "Test desc", "test@x.com", preferred,
                "https://ok", "https://cancel", Map.of("k", "v"), idempotencyKey);
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
        return tx;
    }

    /** Stubs communs pour un flux initiate qui va jusqu'au provider. */
    private PaymentTransaction stubPendingCreation(PaymentProviderType type) {
        when(paymentPersistence.consumeIdempotentReplay(any())).thenReturn(Optional.empty());
        PaymentTransaction pending = buildTx("TX-NEW", TransactionStatus.PENDING, type);
        when(paymentPersistence.createPending(eq(ORG_ID), eq(type), any(), any())).thenReturn(pending);
        return pending;
    }

    @Nested
    @DisplayName("initiatePayment")
    class InitiatePayment {

        @Test
        void embeddedReplayRetrievesExistingCheckoutInsteadOfReturningAnEmptySecret() {
            var request = new PaymentOrchestrationRequest(new BigDecimal("100"), "EUR", "INTERVENTION", 10L,
                "Test", "owner@example.test", null, null, null, Map.of(), "INT-10", true, null, false);
            var tx = buildTx("TX-existing", TransactionStatus.PROCESSING, PaymentProviderType.STRIPE);
            tx.setSourceType("INTERVENTION"); tx.setSourceId(10L); tx.setProviderTxId("cs_existing");
            when(paymentPersistence.consumeIdempotentReplay("INT-10")).thenReturn(Optional.of(tx));
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            when(stripeProvider.resumeEmbeddedPayment("cs_existing", tx.getAmount(), "EUR"))
                .thenReturn(PaymentResult.embedded("cs_existing", "test-existing-secret"));
            var result = service.initiatePayment(request);
            assertThat(result.paymentResult().clientSecret()).isEqualTo("test-existing-secret");
            verify(paymentPersistence, never()).createPending(any(), any(), any(), any());
            verify(stripeProvider, never()).createPayment(any());
        }

        @org.junit.jupiter.params.ParameterizedTest
        @org.junit.jupiter.params.provider.ValueSource(strings = { "org", "source", "amount", "currency", "pending", "completed" })
        void embeddedReplayMustMatchTheCanonicalPaymentAndBeInProgress(String mismatch) {
            var request = new PaymentOrchestrationRequest(new BigDecimal("100"), "EUR", "INTERVENTION", 10L,
                "Test", "owner@example.test", null, null, null, Map.of(), "INT-10", true, null, false);
            var tx = buildTx("TX-existing", TransactionStatus.PROCESSING, PaymentProviderType.STRIPE);
            tx.setSourceType("INTERVENTION"); tx.setSourceId(10L); tx.setProviderTxId("cs_existing");
            switch (mismatch) {
                case "org" -> tx.setOrganizationId(999L);
                case "source" -> tx.setSourceId(999L);
                case "amount" -> tx.setAmount(new BigDecimal("999"));
                case "currency" -> tx.setCurrency("SAR");
                case "pending" -> tx.setStatus(TransactionStatus.PENDING);
                case "completed" -> tx.setStatus(TransactionStatus.COMPLETED);
            }
            when(paymentPersistence.consumeIdempotentReplay("INT-10")).thenReturn(Optional.of(tx));
            assertThat(service.initiatePayment(request).isSuccess()).isFalse();
            org.mockito.Mockito.verifyNoInteractions(providerRegistry, stripeProvider);
            verify(paymentPersistence, never()).createPending(any(), any(), any(), any());
        }

        @Test
        @DisplayName("delegates to persistence and returns PROCESSING on provider success")
        void whenProviderSuccess_thenFinalized() {
            PaymentOrchestrationRequest req = buildRequest("EUR", PaymentProviderType.STRIPE, null);
            stubPendingCreation(PaymentProviderType.STRIPE);
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            when(stripeProvider.getProviderType()).thenReturn(PaymentProviderType.STRIPE);
            when(stripeProvider.createPayment(any(PaymentRequest.class)))
                    .thenReturn(PaymentResult.success("pi_123", "https://stripe.test/checkout"));
            when(paymentPersistence.finalizeInitiation(eq("TX-NEW"), any(), eq(ORG_ID)))
                    .thenReturn(buildTx("TX-NEW", TransactionStatus.PROCESSING, PaymentProviderType.STRIPE));

            PaymentOrchestrationResult result = service.initiatePayment(req);

            assertThat(result.isSuccess()).isTrue();
            assertThat(result.providerUsed()).isEqualTo(PaymentProviderType.STRIPE);
            assertThat(result.paymentResult().providerTxId()).isEqualTo("pi_123");
            verify(paymentPersistence).finalizeInitiation(eq("TX-NEW"), any(), eq(ORG_ID));
            verify(paymentPersistence, never()).markInitiationFailed(any(), any());
        }

        @Test
        @DisplayName("explicit org/country variant bypasses TenantContext")
        void whenExplicitOrgCountry_thenUsesThemNotTenantContext() {
            Long explicitOrg = 99L; // != ORG_ID (42) du TenantContext
            PaymentOrchestrationRequest req = buildRequest("EUR", PaymentProviderType.STRIPE, null);
            when(paymentPersistence.consumeIdempotentReplay(any())).thenReturn(Optional.empty());
            PaymentTransaction pending = buildTx("TX-EXP", TransactionStatus.PENDING, PaymentProviderType.STRIPE);
            when(paymentPersistence.createPending(eq(explicitOrg), eq(PaymentProviderType.STRIPE), any(), any()))
                    .thenReturn(pending);
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            when(stripeProvider.getProviderType()).thenReturn(PaymentProviderType.STRIPE);
            when(stripeProvider.createPayment(any(PaymentRequest.class)))
                    .thenReturn(PaymentResult.success("pi_x", "https://stripe.test/x"));
            when(paymentPersistence.finalizeInitiation(eq("TX-EXP"), any(), eq(explicitOrg)))
                    .thenReturn(buildTx("TX-EXP", TransactionStatus.PROCESSING, PaymentProviderType.STRIPE));

            PaymentOrchestrationResult result = service.initiatePayment(explicitOrg, "MA", req);

            assertThat(result.isSuccess()).isTrue();
            // Les écritures utilisent l'org EXPLICITE (99), pas celui du TenantContext (42).
            verify(paymentPersistence).createPending(eq(explicitOrg), eq(PaymentProviderType.STRIPE), any(), any());
            verify(paymentPersistence).finalizeInitiation(eq("TX-EXP"), any(), eq(explicitOrg));
        }

        @Test
        @DisplayName("marks initiation FAILED (no finalize) when provider throws")
        void whenProviderThrows_thenMarkedFailed() {
            PaymentOrchestrationRequest req = buildRequest("EUR", PaymentProviderType.STRIPE, null);
            stubPendingCreation(PaymentProviderType.STRIPE);
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            when(stripeProvider.getProviderType()).thenReturn(PaymentProviderType.STRIPE);
            when(stripeProvider.createPayment(any(PaymentRequest.class)))
                    .thenThrow(new RuntimeException("Network error"));
            when(paymentPersistence.markInitiationFailed(eq("TX-NEW"), anyString()))
                    .thenReturn(buildTx("TX-NEW", TransactionStatus.FAILED, PaymentProviderType.STRIPE));

            PaymentOrchestrationResult result = service.initiatePayment(req);

            assertThat(result.isSuccess()).isFalse();
            assertThat(result.paymentResult().errorMessage()).contains("Network error");
            verify(paymentPersistence).markInitiationFailed(eq("TX-NEW"), anyString());
            verify(paymentPersistence, never()).finalizeInitiation(any(), any(), any());
        }

        @Test
        @DisplayName("resumes the same hosted checkout without creating another payment")
        void whenIdempotentReplay_thenShortCircuits() {
            PaymentOrchestrationRequest req = buildRequest("EUR", PaymentProviderType.STRIPE, "IDEM-KEY-1");
            PaymentTransaction existing = buildTx("TX-OLD", TransactionStatus.PROCESSING, PaymentProviderType.STRIPE);
            existing.setSourceType("INTERVENTION");
            existing.setSourceId(10L);
            existing.setProviderTxId("cs_old");
            when(paymentPersistence.consumeIdempotentReplay("IDEM-KEY-1")).thenReturn(Optional.of(existing));
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            when(stripeProvider.resumeHostedPayment("cs_old", existing.getAmount(), "EUR"))
                    .thenReturn(PaymentResult.success("cs_old", "https://checkout.stripe.com/existing"));

            PaymentOrchestrationResult result = service.initiatePayment(req);

            assertThat(result.isSuccess()).isTrue();
            assertThat(result.paymentResult().providerTxId()).isEqualTo("cs_old");
            assertThat(result.paymentResult().redirectUrl()).isEqualTo("https://checkout.stripe.com/existing");
            verify(stripeProvider, never()).createPayment(any());
            verify(paymentPersistence, never()).createPending(any(), any(), any(), any());
        }

        @org.junit.jupiter.params.ParameterizedTest
        @org.junit.jupiter.params.provider.ValueSource(strings = {
                "org", "sourceType", "sourceId", "amount", "currency", "pending", "completed", "providerId" })
        void hostedReplayRefusesAnotherDebtOrAStateThatCannotResume(String mismatch) {
            var request = buildRequest("EUR", PaymentProviderType.STRIPE, "INT-10");
            var tx = buildTx("TX-existing", TransactionStatus.PROCESSING, PaymentProviderType.STRIPE);
            tx.setSourceType("INTERVENTION"); tx.setSourceId(10L); tx.setProviderTxId("cs_existing");
            switch (mismatch) {
                case "org" -> tx.setOrganizationId(999L);
                case "sourceType" -> tx.setSourceType("INVOICE");
                case "sourceId" -> tx.setSourceId(999L);
                case "amount" -> tx.setAmount(new BigDecimal("999"));
                case "currency" -> tx.setCurrency("SAR");
                case "pending" -> tx.setStatus(TransactionStatus.PENDING);
                case "completed" -> tx.setStatus(TransactionStatus.COMPLETED);
                case "providerId" -> tx.setProviderTxId(null);
            }
            when(paymentPersistence.consumeIdempotentReplay("INT-10")).thenReturn(Optional.of(tx));
            assertThat(service.initiatePayment(request).isSuccess()).isFalse();
            org.mockito.Mockito.verifyNoInteractions(providerRegistry, stripeProvider);
            verify(paymentPersistence, never()).createPending(any(), any(), any(), any());
        }

        @Test
        void failedHostedResumeDoesNotReleaseTheAttemptOrCreateAnotherPayment() {
            var tx = buildTx("TX-existing", TransactionStatus.PROCESSING, PaymentProviderType.STRIPE);
            tx.setSourceType("INTERVENTION"); tx.setSourceId(10L); tx.setProviderTxId("cs_existing");
            when(paymentPersistence.consumeIdempotentReplay("INT-10")).thenReturn(Optional.of(tx));
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            when(stripeProvider.resumeHostedPayment("cs_existing", tx.getAmount(), "EUR"))
                    .thenReturn(PaymentResult.failure("Vérification PSP indisponible"));
            assertThat(service.initiatePayment(buildRequest("EUR", null, "INT-10")).isSuccess()).isFalse();
            verify(paymentPersistence, never()).createPending(any(), any(), any(), any());
            verify(paymentPersistence, never()).markInitiationFailed(any(), any());
            verify(stripeProvider, never()).createPayment(any());
            assertThat(tx.getStatus()).isEqualTo(TransactionStatus.PROCESSING);
        }

        @Test
        @DisplayName("propagates metadata (orgId, transactionRef, source) to the provider request")
        void whenRequestHasMetadata_thenPropagated() {
            PaymentOrchestrationRequest req = buildRequest("EUR", PaymentProviderType.STRIPE, null);
            stubPendingCreation(PaymentProviderType.STRIPE);
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            when(stripeProvider.getProviderType()).thenReturn(PaymentProviderType.STRIPE);
            when(stripeProvider.createPayment(any(PaymentRequest.class)))
                    .thenReturn(PaymentResult.success("pi", "url"));
            when(paymentPersistence.finalizeInitiation(any(), any(), any()))
                    .thenReturn(buildTx("TX-NEW", TransactionStatus.PROCESSING, PaymentProviderType.STRIPE));

            service.initiatePayment(req);

            ArgumentCaptor<PaymentRequest> captor = ArgumentCaptor.forClass(PaymentRequest.class);
            verify(stripeProvider).createPayment(captor.capture());
            Map<String, String> m = captor.getValue().metadata();
            assertThat(m).containsEntry("k", "v")
                    .containsEntry("orgId", String.valueOf(ORG_ID))
                    .containsEntry("sourceType", "INTERVENTION")
                    .containsEntry("sourceId", "10")
                    .containsEntry("transactionRef", "TX-NEW");
        }
    }

    @Nested
    @DisplayName("resolveProvider")
    class ResolveProvider {

        private void stubProviderSuccess(PaymentProvider provider, PaymentProviderType type) {
            when(provider.getProviderType()).thenReturn(type);
            when(provider.createPayment(any(PaymentRequest.class)))
                    .thenReturn(PaymentResult.success("id", "url"));
            when(paymentPersistence.createPending(eq(ORG_ID), eq(type), any(), any()))
                    .thenReturn(buildTx("TX-NEW", TransactionStatus.PENDING, type));
            when(paymentPersistence.finalizeInitiation(any(), any(), any()))
                    .thenReturn(buildTx("TX-NEW", TransactionStatus.PROCESSING, type));
        }

        @Test
        @DisplayName("uses preferredProvider without consulting config")
        void whenPreferred_thenUsesIt() {
            PaymentOrchestrationRequest req = buildRequest("EUR", PaymentProviderType.PAYTABS, null);
            when(paymentPersistence.consumeIdempotentReplay(any())).thenReturn(Optional.empty());
            when(providerRegistry.get(PaymentProviderType.PAYTABS)).thenReturn(paytabsProvider);
            stubProviderSuccess(paytabsProvider, PaymentProviderType.PAYTABS);

            PaymentOrchestrationResult result = service.initiatePayment(req);

            assertThat(result.providerUsed()).isEqualTo(PaymentProviderType.PAYTABS);
            verify(configService, never()).getEnabledProviders(any(), any());
        }

        @Test
        @DisplayName("resolves PayTabs when currency is SAR and enabled")
        void whenSarAndPaytabsEnabled_thenPaytabs() {
            PaymentOrchestrationRequest req = buildRequest("SAR", null, null);
            when(paymentPersistence.consumeIdempotentReplay(any())).thenReturn(Optional.empty());
            PaymentMethodConfig cfg = new PaymentMethodConfig();
            cfg.setProviderType(PaymentProviderType.PAYTABS);
            when(configService.getEnabledProviders(ORG_ID, "FR")).thenReturn(List.of(cfg));
            when(providerRegistry.get(PaymentProviderType.PAYTABS)).thenReturn(paytabsProvider);
            stubProviderSuccess(paytabsProvider, PaymentProviderType.PAYTABS);

            assertThat(service.initiatePayment(req).providerUsed()).isEqualTo(PaymentProviderType.PAYTABS);
        }

        @Test
        @DisplayName("shipping requirement routes past an incapable regional provider (capability, not pin)")
        void whenShippingRequired_thenSkipsIncapableRegionalProvider() {
            // MAD + PayZone activé pour l'org, MAIS le flux demande la collecte
            // d'adresse (SHIPPING_ADDRESS) que PayZone ne déclare pas → fallback Stripe.
            // C'est la capacité qui tranche, pas un preferredProvider épinglé.
            PaymentOrchestrationRequest req = new PaymentOrchestrationRequest(
                    BigDecimal.valueOf(100), "MAD", "HARDWARE_ORDER", 42L,
                    "Matériel", "b@x.ma", null, "https://ok", "https://ko",
                    Map.of(), null, false, null, false, List.of("MA", "FR"));
            when(paymentPersistence.consumeIdempotentReplay(any())).thenReturn(Optional.empty());
            PaymentMethodConfig payzoneCfg = new PaymentMethodConfig();
            payzoneCfg.setProviderType(PaymentProviderType.PAYZONE);
            when(configService.getEnabledProviders(ORG_ID, "FR")).thenReturn(List.of(payzoneCfg));
            PaymentProvider payzoneProvider = org.mockito.Mockito.mock(PaymentProvider.class);
            org.mockito.Mockito.lenient().when(payzoneProvider.supports(any()))
                    .thenAnswer(inv -> inv.getArgument(0) != com.clenzy.payment.PaymentCapability.SHIPPING_ADDRESS);
            when(providerRegistry.get(PaymentProviderType.PAYZONE)).thenReturn(payzoneProvider);
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            stubProviderSuccess(stripeProvider, PaymentProviderType.STRIPE);

            assertThat(service.initiatePayment(req).providerUsed()).isEqualTo(PaymentProviderType.STRIPE);
            verify(payzoneProvider, never()).createPayment(any());
        }

        @Test
        @DisplayName("falls back to Stripe when no provider enabled")
        void whenNoneEnabled_thenStripe() {
            PaymentOrchestrationRequest req = buildRequest("EUR", null, null);
            when(paymentPersistence.consumeIdempotentReplay(any())).thenReturn(Optional.empty());
            when(configService.getEnabledProviders(ORG_ID, "FR")).thenReturn(List.of());
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            stubProviderSuccess(stripeProvider, PaymentProviderType.STRIPE);

            assertThat(service.initiatePayment(req).providerUsed()).isEqualTo(PaymentProviderType.STRIPE);
        }

        @Test
        @DisplayName("uses first enabled provider on plain country match")
        void whenCountryMatch_thenFirstConfig() {
            PaymentOrchestrationRequest req = buildRequest("EUR", null, null);
            when(paymentPersistence.consumeIdempotentReplay(any())).thenReturn(Optional.empty());
            PaymentMethodConfig cfg = new PaymentMethodConfig();
            cfg.setProviderType(PaymentProviderType.STRIPE);
            when(configService.getEnabledProviders(ORG_ID, "FR")).thenReturn(List.of(cfg));
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            stubProviderSuccess(stripeProvider, PaymentProviderType.STRIPE);

            assertThat(service.initiatePayment(req).providerUsed()).isEqualTo(PaymentProviderType.STRIPE);
        }
    }

    @Nested
    @DisplayName("processRefund")
    class ProcessRefund {

        @Test
        @DisplayName("creates refund, calls provider out of tx, finalizes on success")
        void whenSuccess_thenFinalized() {
            PaymentPersistence.RefundInit init = new PaymentPersistence.RefundInit(
                    "REF-1", PaymentProviderType.STRIPE, "pi_orig", "TX-ORIG", "EUR", BigDecimal.valueOf(100), BigDecimal.valueOf(100), TransactionStatus.PROCESSING, null, java.time.LocalDateTime.now());
            when(paymentPersistence.createRefundPending(ORG_ID, "TX-ORIG", BigDecimal.valueOf(100)))
                    .thenReturn(init);
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            when(stripeProvider.refundPayment(any(RefundContext.class), any(BigDecimal.class), anyString()))
                    .thenReturn(PaymentResult.success("rf_123", null));
            when(paymentPersistence.finalizeRefund(eq("REF-1"), any(), eq(ORG_ID)))
                    .thenReturn(buildTx("REF-1", TransactionStatus.COMPLETED, PaymentProviderType.STRIPE));

            PaymentOrchestrationResult result = service.processRefund("TX-ORIG", BigDecimal.valueOf(100), "reason");

            assertThat(result.isSuccess()).isTrue();
            assertThat(result.paymentResult().providerTxId()).isEqualTo("rf_123");
            verify(paymentPersistence).finalizeRefund(eq("REF-1"), any(), eq(ORG_ID));
            verify(paymentPersistence, never()).markRefundFailed(any(), any());
            verify(stripeProvider).refundPayment(org.mockito.ArgumentMatchers.argThat((RefundContext context) -> "REF-1".equals(context.refundTransactionRef())
                    && context.requestedAt() != null), eq(BigDecimal.valueOf(100)), eq("reason"));
        }

        @Test
        void completedDecisionIsReturnedWithoutCallingProviderAgain() {
            var init = new PaymentPersistence.RefundInit("REF-1", PaymentProviderType.STRIPE, "cs_orig", "TX-ORIG", "EUR",
                    BigDecimal.valueOf(100), BigDecimal.valueOf(100), TransactionStatus.COMPLETED, "re_done", java.time.LocalDateTime.now());
            when(paymentPersistence.createRefundPending(ORG_ID, "TX-ORIG", null)).thenReturn(init);
            when(paymentPersistence.finalizeRefund(eq("REF-1"), any(), eq(ORG_ID)))
                    .thenReturn(buildTx("REF-1", TransactionStatus.COMPLETED, PaymentProviderType.STRIPE));
            assertThat(service.processRefund("TX-ORIG", null, "retry").isSuccess()).isTrue();
            org.mockito.Mockito.verifyNoInteractions(providerRegistry, stripeProvider);
        }

        @Test
        @DisplayName("marks refund FAILED when provider throws")
        void whenProviderThrows_thenFailed() {
            PaymentPersistence.RefundInit init = new PaymentPersistence.RefundInit(
                    "REF-1", PaymentProviderType.STRIPE, "pi_orig", "TX-ORIG", "EUR", BigDecimal.valueOf(100), BigDecimal.valueOf(100), TransactionStatus.PROCESSING, null, java.time.LocalDateTime.now());
            when(paymentPersistence.createRefundPending(eq(ORG_ID), eq("TX-ORIG"), any()))
                    .thenReturn(init);
            when(providerRegistry.get(PaymentProviderType.STRIPE)).thenReturn(stripeProvider);
            when(stripeProvider.refundPayment(any(RefundContext.class), any(BigDecimal.class), anyString()))
                    .thenThrow(new RuntimeException("boom"));
            when(paymentPersistence.markRefundFailed(eq("REF-1"), anyString()))
                    .thenReturn(buildTx("REF-1", TransactionStatus.FAILED, PaymentProviderType.STRIPE));

            PaymentOrchestrationResult result = service.processRefund("TX-ORIG", null, "reason");

            assertThat(result.isSuccess()).isFalse();
            assertThat(result.paymentResult().errorMessage()).contains("boom");
            verify(paymentPersistence).markRefundFailed(eq("REF-1"), anyString());
            verify(paymentPersistence, never()).finalizeRefund(any(), any(), any());
        }
    }

    @Nested
    @DisplayName("webhook delegation")
    class WebhookDelegation {

        @Test
        @DisplayName("completeTransaction delegates to persistence")
        void completeDelegates() {
            PaymentTransaction tx = buildTx("TX-1", TransactionStatus.COMPLETED, PaymentProviderType.STRIPE);
            when(paymentPersistence.completeTransaction("TX-1")).thenReturn(tx);

            assertThat(service.completeTransaction("TX-1")).isSameAs(tx);
            verify(paymentPersistence).completeTransaction("TX-1");
        }

        @Test
        @DisplayName("failTransaction delegates to persistence")
        void failDelegates() {
            PaymentTransaction tx = buildTx("TX-1", TransactionStatus.FAILED, PaymentProviderType.STRIPE);
            when(paymentPersistence.failTransaction("TX-1", "err")).thenReturn(tx);

            assertThat(service.failTransaction("TX-1", "err")).isSameAs(tx);
            verify(paymentPersistence).failTransaction("TX-1", "err");
        }
    }
}
