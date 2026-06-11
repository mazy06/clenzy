package com.clenzy.controller;

import com.clenzy.model.PaymentMethodConfig;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.model.PaymentTransaction;
import com.clenzy.payment.provider.CmiHashService;
import com.clenzy.payment.provider.PayTabsPaymentProvider;
import com.clenzy.payment.provider.PayzonePaymentProvider;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.service.PaymentMethodConfigService;
import com.clenzy.service.PaymentOrchestrationService;
import com.clenzy.service.PaymentTransactionService;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.lang.reflect.Field;
import java.util.HashMap;
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
 * Unit tests for {@link PaymentWebhookRouter}.
 *
 * <p>Covers signature validation, payload parsing, provider routing
 * (PayTabs, CMI, Payzone), success vs failure status dispatch.</p>
 */
@ExtendWith(MockitoExtension.class)
class PaymentWebhookRouterTest {

    @Mock private PaymentOrchestrationService orchestrationService;
    @Mock private PaymentMethodConfigService configService;
    @Mock private PayTabsPaymentProvider payTabsProvider;
    @Mock private PayzonePaymentProvider payzoneProvider;
    @Mock private CmiHashService cmiHashService;
    @Mock private PaymentTransactionRepository transactionRepository;
    @Mock private TenantContext tenantContext;

    private PaymentWebhookRouter router;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() throws Exception {
        objectMapper = new ObjectMapper();
        // T-ARCH-01 : le router n'injecte plus le repository — service reel
        // construit sur le repository mocke (les stubs existants restent valides).
        PaymentTransactionService paymentTransactionService =
                new PaymentTransactionService(transactionRepository, tenantContext);
        router = new PaymentWebhookRouter(orchestrationService, configService,
                payTabsProvider, payzoneProvider, cmiHashService,
                paymentTransactionService, objectMapper);
        Field f = PaymentWebhookRouter.class.getDeclaredField("stripeWebhookSecret");
        f.setAccessible(true);
        f.set(router, "whsec_test");
    }

    private PaymentTransaction buildTx(String ref, Long orgId) {
        PaymentTransaction tx = new PaymentTransaction();
        tx.setOrganizationId(orgId);
        tx.setTransactionRef(ref);
        tx.setProviderType(PaymentProviderType.PAYTABS);
        tx.setPaymentType(com.clenzy.model.TransactionType.CHECKOUT);
        tx.setStatus(com.clenzy.model.TransactionStatus.PROCESSING);
        tx.setAmount(java.math.BigDecimal.valueOf(100));
        tx.setCurrency("EUR");
        return tx;
    }

    // ─── Stripe webhook ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("handleStripeWebhook")
    class StripeWebhook {

        @Test
        @DisplayName("returns 401 when no signature header")
        void whenNoSignature_thenUnauthorized() {
            ResponseEntity<String> response = router.handleStripeWebhook("{}", null);
            assertThat(response.getStatusCode().value()).isEqualTo(401);
        }

        @Test
        @DisplayName("returns 401 when blank signature header")
        void whenBlankSignature_thenUnauthorized() {
            ResponseEntity<String> response = router.handleStripeWebhook("{}", "  ");
            assertThat(response.getStatusCode().value()).isEqualTo(401);
        }

        @Test
        @DisplayName("returns 401 when signature verification fails")
        void whenInvalidSignature_thenUnauthorized() {
            ResponseEntity<String> response = router.handleStripeWebhook(
                    "{\"id\":\"evt_1\",\"type\":\"checkout.session.completed\"}",
                    "t=1234,v1=bad");
            assertThat(response.getStatusCode().value()).isEqualTo(401);
        }
    }

    // ─── PayTabs webhook ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("handlePayTabsWebhook")
    class PayTabsWebhook {

        @Test
        @DisplayName("returns 401 when signature is null")
        void whenNullSignature_thenUnauthorized() {
            ResponseEntity<String> response = router.handlePayTabsWebhook("{}", null);
            assertThat(response.getStatusCode().value()).isEqualTo(401);
        }

        @Test
        @DisplayName("returns 401 when signature is blank")
        void whenBlankSignature_thenUnauthorized() {
            ResponseEntity<String> response = router.handlePayTabsWebhook("{}", "  ");
            assertThat(response.getStatusCode().value()).isEqualTo(401);
        }

        @Test
        @DisplayName("returns 400 when payload is invalid JSON")
        void whenInvalidJson_thenBadRequest() {
            ResponseEntity<String> response = router.handlePayTabsWebhook("not-json", "sig");
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        @DisplayName("returns 400 when cart_id is missing")
        void whenNoCartId_thenBadRequest() {
            ResponseEntity<String> response = router.handlePayTabsWebhook("{\"other\":\"x\"}", "sig");
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        @DisplayName("returns 404 when transaction not found")
        void whenTxNotFound_thenNotFound() {
            when(transactionRepository.findByTransactionRef("CART-1")).thenReturn(Optional.empty());

            ResponseEntity<String> response = router.handlePayTabsWebhook(
                    "{\"cart_id\":\"CART-1\"}", "sig");

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }

        @Test
        @DisplayName("returns 500 when server key is missing")
        void whenServerKeyMissing_thenInternalError() {
            PaymentTransaction tx = buildTx("CART-1", 1L);
            when(transactionRepository.findByTransactionRef("CART-1")).thenReturn(Optional.of(tx));
            PaymentMethodConfig cfg = new PaymentMethodConfig();
            when(configService.getOrCreateConfig(1L, PaymentProviderType.PAYTABS)).thenReturn(cfg);
            when(configService.decryptApiKey(cfg)).thenReturn(null);

            ResponseEntity<String> response = router.handlePayTabsWebhook(
                    "{\"cart_id\":\"CART-1\"}", "sig");

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }

        @Test
        @DisplayName("returns 401 when signature verification fails")
        void whenSignatureInvalid_thenUnauthorized() {
            PaymentTransaction tx = buildTx("CART-1", 1L);
            when(transactionRepository.findByTransactionRef("CART-1")).thenReturn(Optional.of(tx));
            PaymentMethodConfig cfg = new PaymentMethodConfig();
            when(configService.getOrCreateConfig(1L, PaymentProviderType.PAYTABS)).thenReturn(cfg);
            when(configService.decryptApiKey(cfg)).thenReturn("server-key");
            when(payTabsProvider.verifyWebhook(any(), any(), any())).thenReturn(false);

            ResponseEntity<String> response = router.handlePayTabsWebhook(
                    "{\"cart_id\":\"CART-1\"}", "sig");

            assertThat(response.getStatusCode().value()).isEqualTo(401);
            verify(orchestrationService, never()).completeTransaction(any());
        }

        @Test
        @DisplayName("completes transaction when status is A (approved)")
        void whenStatusApproved_thenCompletesTransaction() {
            PaymentTransaction tx = buildTx("CART-1", 1L);
            when(transactionRepository.findByTransactionRef("CART-1")).thenReturn(Optional.of(tx));
            PaymentMethodConfig cfg = new PaymentMethodConfig();
            when(configService.getOrCreateConfig(1L, PaymentProviderType.PAYTABS)).thenReturn(cfg);
            when(configService.decryptApiKey(cfg)).thenReturn("server-key");
            when(payTabsProvider.verifyWebhook(any(), any(), any())).thenReturn(true);

            ResponseEntity<String> response = router.handlePayTabsWebhook(
                    "{\"cart_id\":\"CART-1\",\"payment_result\":{\"response_status\":\"A\"}}",
                    "sig");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(orchestrationService).completeTransaction("CART-1");
        }

        @Test
        @DisplayName("fails transaction when status is D (declined)")
        void whenStatusDeclined_thenFailsTransaction() {
            PaymentTransaction tx = buildTx("CART-1", 1L);
            when(transactionRepository.findByTransactionRef("CART-1")).thenReturn(Optional.of(tx));
            PaymentMethodConfig cfg = new PaymentMethodConfig();
            when(configService.getOrCreateConfig(1L, PaymentProviderType.PAYTABS)).thenReturn(cfg);
            when(configService.decryptApiKey(cfg)).thenReturn("server-key");
            when(payTabsProvider.verifyWebhook(any(), any(), any())).thenReturn(true);

            ResponseEntity<String> response = router.handlePayTabsWebhook(
                    "{\"cart_id\":\"CART-1\",\"payment_result\":{\"response_status\":\"D\",\"response_message\":\"declined\"}}",
                    "sig");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(orchestrationService).failTransaction(eq("CART-1"), anyString());
        }

        @Test
        @DisplayName("fails transaction when status is E (error)")
        void whenStatusError_thenFailsTransaction() {
            PaymentTransaction tx = buildTx("CART-1", 1L);
            when(transactionRepository.findByTransactionRef("CART-1")).thenReturn(Optional.of(tx));
            PaymentMethodConfig cfg = new PaymentMethodConfig();
            when(configService.getOrCreateConfig(1L, PaymentProviderType.PAYTABS)).thenReturn(cfg);
            when(configService.decryptApiKey(cfg)).thenReturn("server-key");
            when(payTabsProvider.verifyWebhook(any(), any(), any())).thenReturn(true);

            ResponseEntity<String> response = router.handlePayTabsWebhook(
                    "{\"cart_id\":\"CART-1\",\"payment_result\":{\"response_status\":\"E\"}}",
                    "sig");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(orchestrationService).failTransaction(eq("CART-1"), anyString());
        }

        @Test
        @DisplayName("returns 200 with no action when status is unknown")
        void whenStatusUnknown_thenNoOp() {
            PaymentTransaction tx = buildTx("CART-1", 1L);
            when(transactionRepository.findByTransactionRef("CART-1")).thenReturn(Optional.of(tx));
            PaymentMethodConfig cfg = new PaymentMethodConfig();
            when(configService.getOrCreateConfig(1L, PaymentProviderType.PAYTABS)).thenReturn(cfg);
            when(configService.decryptApiKey(cfg)).thenReturn("server-key");
            when(payTabsProvider.verifyWebhook(any(), any(), any())).thenReturn(true);

            ResponseEntity<String> response = router.handlePayTabsWebhook(
                    "{\"cart_id\":\"CART-1\",\"payment_result\":{\"response_status\":\"P\"}}",
                    "sig");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(orchestrationService, never()).completeTransaction(any());
            verify(orchestrationService, never()).failTransaction(any(), any());
        }
    }

    // ─── CMI webhook ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("handleCmiWebhook")
    class CmiWebhook {

        @Test
        @DisplayName("returns 401 when HASH is missing")
        void whenNoHash_thenUnauthorized() {
            Map<String, String> params = new HashMap<>();
            params.put("oid", "TX-1");
            ResponseEntity<String> response = router.handleCmiWebhook(params);
            assertThat(response.getStatusCode().value()).isEqualTo(401);
        }

        @Test
        @DisplayName("returns 400 when oid is missing")
        void whenNoOid_thenBadRequest() {
            Map<String, String> params = new HashMap<>();
            params.put("HASH", "abc");
            ResponseEntity<String> response = router.handleCmiWebhook(params);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        @DisplayName("returns 404 when transaction not found")
        void whenTxNotFound_thenNotFound() {
            Map<String, String> params = new HashMap<>();
            params.put("HASH", "h"); params.put("oid", "TX-1");
            when(transactionRepository.findByTransactionRef("TX-1")).thenReturn(Optional.empty());

            ResponseEntity<String> response = router.handleCmiWebhook(params);

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }

        @Test
        @DisplayName("returns 500 when store_key is missing")
        void whenStoreKeyMissing_thenInternalError() {
            Map<String, String> params = new HashMap<>();
            params.put("HASH", "h"); params.put("oid", "TX-1");
            PaymentTransaction tx = buildTx("TX-1", 1L);
            when(transactionRepository.findByTransactionRef("TX-1")).thenReturn(Optional.of(tx));
            PaymentMethodConfig cfg = new PaymentMethodConfig();
            when(configService.getOrCreateConfig(1L, PaymentProviderType.CMI)).thenReturn(cfg);
            when(configService.decryptApiSecret(cfg)).thenReturn(null);

            ResponseEntity<String> response = router.handleCmiWebhook(params);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }

        @Test
        @DisplayName("returns 401 when HASH verification fails")
        void whenInvalidHash_thenUnauthorized() {
            Map<String, String> params = new HashMap<>();
            params.put("HASH", "h"); params.put("oid", "TX-1");
            PaymentTransaction tx = buildTx("TX-1", 1L);
            when(transactionRepository.findByTransactionRef("TX-1")).thenReturn(Optional.of(tx));
            PaymentMethodConfig cfg = new PaymentMethodConfig();
            when(configService.getOrCreateConfig(1L, PaymentProviderType.CMI)).thenReturn(cfg);
            when(configService.decryptApiSecret(cfg)).thenReturn("store-key");
            when(cmiHashService.verifyHash(any(), any())).thenReturn(false);

            ResponseEntity<String> response = router.handleCmiWebhook(params);

            assertThat(response.getStatusCode().value()).isEqualTo(401);
        }

        @Test
        @DisplayName("completes transaction when ProcReturnCode=00 and Response=Approved")
        void whenApproved_thenCompletesTransaction() {
            Map<String, String> params = new HashMap<>();
            params.put("HASH", "h"); params.put("oid", "TX-1");
            params.put("ProcReturnCode", "00"); params.put("Response", "Approved");
            PaymentTransaction tx = buildTx("TX-1", 1L);
            when(transactionRepository.findByTransactionRef("TX-1")).thenReturn(Optional.of(tx));
            PaymentMethodConfig cfg = new PaymentMethodConfig();
            when(configService.getOrCreateConfig(1L, PaymentProviderType.CMI)).thenReturn(cfg);
            when(configService.decryptApiSecret(cfg)).thenReturn("store-key");
            when(cmiHashService.verifyHash(any(), any())).thenReturn(true);

            ResponseEntity<String> response = router.handleCmiWebhook(params);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(orchestrationService).completeTransaction("TX-1");
        }

        @Test
        @DisplayName("fails transaction when ProcReturnCode is not 00")
        void whenDeclined_thenFailsTransaction() {
            Map<String, String> params = new HashMap<>();
            params.put("HASH", "h"); params.put("oid", "TX-1");
            params.put("ProcReturnCode", "05"); params.put("Response", "Declined");
            params.put("ErrMsg", "Card declined");
            PaymentTransaction tx = buildTx("TX-1", 1L);
            when(transactionRepository.findByTransactionRef("TX-1")).thenReturn(Optional.of(tx));
            PaymentMethodConfig cfg = new PaymentMethodConfig();
            when(configService.getOrCreateConfig(1L, PaymentProviderType.CMI)).thenReturn(cfg);
            when(configService.decryptApiSecret(cfg)).thenReturn("store-key");
            when(cmiHashService.verifyHash(any(), any())).thenReturn(true);

            ResponseEntity<String> response = router.handleCmiWebhook(params);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(orchestrationService).failTransaction(eq("TX-1"), anyString());
        }
    }

    // ─── Payzone webhook ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("handlePayzoneWebhook")
    class PayzoneWebhook {

        @Test
        @DisplayName("returns 401 when signature is null")
        void whenNullSignature_thenUnauthorized() {
            ResponseEntity<String> response = router.handlePayzoneWebhook("{}", null);
            assertThat(response.getStatusCode().value()).isEqualTo(401);
        }

        @Test
        @DisplayName("returns 400 when payload is invalid JSON")
        void whenInvalidJson_thenBadRequest() {
            ResponseEntity<String> response = router.handlePayzoneWebhook("not-json", "sig");
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        @DisplayName("returns 400 when merchant_reference is missing")
        void whenNoRef_thenBadRequest() {
            ResponseEntity<String> response = router.handlePayzoneWebhook("{}", "sig");
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        @DisplayName("returns 404 when transaction not found")
        void whenTxNotFound_thenNotFound() {
            when(transactionRepository.findByTransactionRef("REF-1")).thenReturn(Optional.empty());

            ResponseEntity<String> response = router.handlePayzoneWebhook(
                    "{\"merchant_reference\":\"REF-1\"}", "sig");

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }

        @Test
        @DisplayName("falls back to apiKey when webhook secret is null")
        void whenWebhookSecretNull_thenUsesApiKey() {
            PaymentTransaction tx = buildTx("REF-1", 1L);
            when(transactionRepository.findByTransactionRef("REF-1")).thenReturn(Optional.of(tx));
            PaymentMethodConfig cfg = new PaymentMethodConfig();
            when(configService.getOrCreateConfig(1L, PaymentProviderType.PAYZONE)).thenReturn(cfg);
            when(configService.decryptWebhookSecret(cfg)).thenReturn(null);
            when(configService.decryptApiKey(cfg)).thenReturn("api-key");
            when(payzoneProvider.verifyWebhook(any(), any(), eq("api-key"))).thenReturn(true);

            ResponseEntity<String> response = router.handlePayzoneWebhook(
                    "{\"merchant_reference\":\"REF-1\",\"status\":\"completed\"}", "sig");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(orchestrationService).completeTransaction("REF-1");
        }

        @Test
        @DisplayName("returns 500 when both webhook secret and apiKey missing")
        void whenAllSecretsMissing_thenInternalError() {
            PaymentTransaction tx = buildTx("REF-1", 1L);
            when(transactionRepository.findByTransactionRef("REF-1")).thenReturn(Optional.of(tx));
            PaymentMethodConfig cfg = new PaymentMethodConfig();
            when(configService.getOrCreateConfig(1L, PaymentProviderType.PAYZONE)).thenReturn(cfg);
            when(configService.decryptWebhookSecret(cfg)).thenReturn(null);
            when(configService.decryptApiKey(cfg)).thenReturn(null);

            ResponseEntity<String> response = router.handlePayzoneWebhook(
                    "{\"merchant_reference\":\"REF-1\"}", "sig");

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }

        @Test
        @DisplayName("returns 401 when signature verification fails")
        void whenInvalidSig_thenUnauthorized() {
            PaymentTransaction tx = buildTx("REF-1", 1L);
            when(transactionRepository.findByTransactionRef("REF-1")).thenReturn(Optional.of(tx));
            PaymentMethodConfig cfg = new PaymentMethodConfig();
            when(configService.getOrCreateConfig(1L, PaymentProviderType.PAYZONE)).thenReturn(cfg);
            when(configService.decryptWebhookSecret(cfg)).thenReturn("ws");
            when(payzoneProvider.verifyWebhook(any(), any(), any())).thenReturn(false);

            ResponseEntity<String> response = router.handlePayzoneWebhook(
                    "{\"merchant_reference\":\"REF-1\"}", "sig");

            assertThat(response.getStatusCode().value()).isEqualTo(401);
        }

        @Test
        @DisplayName("completes when status is 'completed' or 'succeeded' (case-insensitive)")
        void whenStatusCompleted_thenCompletes() {
            PaymentTransaction tx = buildTx("REF-1", 1L);
            when(transactionRepository.findByTransactionRef("REF-1")).thenReturn(Optional.of(tx));
            PaymentMethodConfig cfg = new PaymentMethodConfig();
            when(configService.getOrCreateConfig(1L, PaymentProviderType.PAYZONE)).thenReturn(cfg);
            when(configService.decryptWebhookSecret(cfg)).thenReturn("ws");
            when(payzoneProvider.verifyWebhook(any(), any(), any())).thenReturn(true);

            ResponseEntity<String> response = router.handlePayzoneWebhook(
                    "{\"merchant_reference\":\"REF-1\",\"status\":\"COMPLETED\"}", "sig");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(orchestrationService).completeTransaction("REF-1");
        }

        @Test
        @DisplayName("fails when status is 'failed', 'declined', or 'cancelled'")
        void whenStatusFailed_thenFails() {
            PaymentTransaction tx = buildTx("REF-1", 1L);
            when(transactionRepository.findByTransactionRef("REF-1")).thenReturn(Optional.of(tx));
            PaymentMethodConfig cfg = new PaymentMethodConfig();
            when(configService.getOrCreateConfig(1L, PaymentProviderType.PAYZONE)).thenReturn(cfg);
            when(configService.decryptWebhookSecret(cfg)).thenReturn("ws");
            when(payzoneProvider.verifyWebhook(any(), any(), any())).thenReturn(true);

            ResponseEntity<String> response = router.handlePayzoneWebhook(
                    "{\"merchant_reference\":\"REF-1\",\"status\":\"failed\",\"failure_reason\":\"card\"}",
                    "sig");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(orchestrationService).failTransaction(eq("REF-1"), anyString());
        }

        @Test
        @DisplayName("returns 200 with no action when status is unknown")
        void whenStatusUnknown_thenNoOp() {
            PaymentTransaction tx = buildTx("REF-1", 1L);
            when(transactionRepository.findByTransactionRef("REF-1")).thenReturn(Optional.of(tx));
            PaymentMethodConfig cfg = new PaymentMethodConfig();
            when(configService.getOrCreateConfig(1L, PaymentProviderType.PAYZONE)).thenReturn(cfg);
            when(configService.decryptWebhookSecret(cfg)).thenReturn("ws");
            when(payzoneProvider.verifyWebhook(any(), any(), any())).thenReturn(true);

            ResponseEntity<String> response = router.handlePayzoneWebhook(
                    "{\"merchant_reference\":\"REF-1\",\"status\":\"pending\"}", "sig");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(orchestrationService, never()).completeTransaction(any());
            verify(orchestrationService, never()).failTransaction(any(), any());
        }
    }

}
